// speechManager.js - Handles speech recognition
export class SpeechManager {
  constructor() {
    this.recognition = null
    this.isRecording = false
    this.onResultCallback = null
    this.onErrorCallback = null
    this.onEndCallback = null
  }

  get isSupported() {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
  }

  initialize(config = {}) {
    if (!this.isSupported) {
      console.error('SpeechRecognition API not supported')
      return false
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    this.recognition = new SpeechRecognition()

    this.recognition.lang = config.lang || 'en-US'
    this.recognition.interimResults = config.interimResults || false
    this.recognition.maxAlternatives = config.maxAlternatives || 1
    this.recognition.continuous = config.continuous || false

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      console.log('Speech recognition result:', transcript)

      if (this.onResultCallback) {
        this.onResultCallback(transcript)
      }
    }

    this.recognition.onerror = (event) => {
      console.error('SpeechRecognition error:', event.error)

      if (event.error === 'no-speech') {
        console.warn('No speech detected. Please try speaking clearly.')
      }

      this.isRecording = false

      if (this.onErrorCallback) {
        this.onErrorCallback(event.error)
      }
    }

    this.recognition.onend = () => {
      console.log('Speech recognition ended')
      this.isRecording = false

      if (this.onEndCallback) {
        this.onEndCallback()
      }
    }

    this.recognition.onstart = () => {
      console.log('Speech recognition started')
      this.isRecording = true
    }

    return true
  }

  startRecording() {
    if (!this.recognition) {
      console.error('SpeechRecognition not initialized')
      return false
    }

    if (this.isRecording) {
      console.warn('Already recording')
      return false
    }

    try {
      this.recognition.start()
      return true
    } catch (error) {
      console.error('Failed to start speech recognition:', error)
      return false
    }
  }

  stopRecording() {
    if (!this.recognition || !this.isRecording) {
      return false
    }

    try {
      this.recognition.stop()
      return true
    } catch (error) {
      console.error('Failed to stop speech recognition:', error)
      return false
    }
  }

  toggleRecording() {
    if (this.isRecording) {
      return this.stopRecording()
    } else {
      return this.startRecording()
    }
  }

  setOnResult(callback) {
    this.onResultCallback = callback
  }

  setOnError(callback) {
    this.onErrorCallback = callback
  }

  setOnEnd(callback) {
    this.onEndCallback = callback
  }

  cleanup() {
    if (this.recognition && this.isRecording) {
      this.recognition.stop()
    }

    this.recognition = null
    this.isRecording = false
    this.onResultCallback = null
    this.onErrorCallback = null
    this.onEndCallback = null
  }
}
