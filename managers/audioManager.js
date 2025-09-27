// audioManager.js - Handles audio context, TTS, and voice synthesis
import axios from 'axios'

export class AudioManager {
  constructor() {
    this.audioCtx = null
    this.analyser = null
    this.sourceNode = null
    this.mouthRaf = null
    this.isInitialized = false
  }

  async initialize() {
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      this.isInitialized = true
      console.log('AudioManager initialized')
    } catch (error) {
      console.error('Failed to initialize AudioManager:', error)
    }
  }

  async resumeContext() {
    if (this.audioCtx && this.audioCtx.state !== 'running') {
      try {
        await this.audioCtx.resume()
      } catch (error) {
        console.error('Failed to resume audio context:', error)
      }
    }
  }

  async generateTTS(text, config) {
    try {
      const ttsUrl = ' https://a36a9fe4f0cd.ngrok-free.app/tts'
      const payload = {
        text,
        ref_audio_path: config.sovits_ping_config?.ref_audio_path,
        text_lang: config.sovits_ping_config?.text_lang || 'en',
        prompt_text: config.sovits_ping_config?.prompt_text || '',
        prompt_lang: config.sovits_ping_config?.prompt_lang || 'en',
        media_type: 'wav',
        streaming_mode: false,
      }

      const response = await axios.post(ttsUrl, payload, {
        responseType: 'arraybuffer',
        headers: { 'Content-Type': 'application/json' },
      })

      const blob = new Blob([response.data], { type: 'audio/wav' })
      return blob
    } catch (error) {
      console.error('TTS generation error:', error)
      return null
    }
  }

  async playAudioBlob(blob, audioElement) {
    if (!blob || !audioElement) return 0

    try {
      audioElement.pause()
    } catch {
      /* ignore */
    }

    audioElement.src = ''
    audioElement.load()

    await this.resumeContext()

    const url = URL.createObjectURL(blob)
    audioElement.src = url

    const playPromise = new Promise((resolve) => {
      audioElement.onplay = () => resolve()
    })

    try {
      await audioElement.play()
      await playPromise
      return audioElement.duration
    } catch (error) {
      console.error('Audio play failed:', error)
      return 0
    }
  }

  setupMouthSync(audioElement, vrm) {
    if (!vrm?.expressionManager || !this.audioCtx || !audioElement) return

    if (this.mouthRaf) {
      cancelAnimationFrame(this.mouthRaf)
    }

    if (!this.sourceNode) {
      this.sourceNode = this.audioCtx.createMediaElementSource(audioElement)
    }

    if (this.analyser) {
      this.analyser.disconnect()
    }

    this.analyser = this.audioCtx.createAnalyser()
    this.analyser.fftSize = 2048
    this.analyser.smoothingTimeConstant = 0.3

    const bufferLength = this.analyser.fftSize
    const dataArray = new Uint8Array(bufferLength)
    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount)

    try {
      this.sourceNode.disconnect()
    } catch {
      /* ignore */
    }

    this.sourceNode.connect(this.analyser)
    this.analyser.connect(this.audioCtx.destination)

    let prevEnergy = 0
    let prevHighFreq = 0

    const tick = () => {
      this.analyser.getByteTimeDomainData(dataArray)
      this.analyser.getByteFrequencyData(frequencyData)

      // Calculate RMS energy
      let sumSquares = 0
      for (let i = 0; i < bufferLength; i++) {
        const val = (dataArray[i] - 128) / 128
        sumSquares += val * val
      }
      const rms = Math.sqrt(sumSquares / bufferLength)

      // Calculate high frequency content
      let highFreqSum = 0
      for (let i = Math.floor(frequencyData.length * 0.3); i < frequencyData.length; i++) {
        highFreqSum += frequencyData[i]
      }
      const highFreq = highFreqSum / (frequencyData.length * 0.7) / 255

      // Smooth values
      const smoothed = prevEnergy * 0.7 + rms * 0.3
      const smoothedHigh = prevHighFreq * 0.8 + highFreq * 0.2
      prevEnergy = smoothed
      prevHighFreq = smoothedHigh

      // Map to mouth shapes
      const mouthOpen = Math.min(Math.max(smoothed * 8, 0), 1)
      const mouthWide = Math.min(smoothedHigh * 2, 1)
      const mouthSmile = Math.min(smoothedHigh * 1.5, 0.5)

      // Apply smoothing to existing values
      const curAA = vrm.expressionManager.getValue('aa') || 0
      const curEE = vrm.expressionManager.getValue('ee') || 0
      const curOH = vrm.expressionManager.getValue('oh') || 0
      const curSmile = vrm.expressionManager.getValue('happy') || 0

      vrm.expressionManager.setValue('aa', curAA + (mouthOpen - curAA) * 0.3)
      vrm.expressionManager.setValue('ee', curEE + (mouthWide - curEE) * 0.25)
      vrm.expressionManager.setValue('oh', curOH + (mouthOpen * 0.6 - curOH) * 0.2)
      vrm.expressionManager.setValue('happy', curSmile + (mouthSmile - curSmile) * 0.1)
      vrm.expressionManager.update()

      if (!audioElement.paused && !audioElement.ended) {
        this.mouthRaf = requestAnimationFrame(tick)
      } else {
        this.resetMouth(vrm)
        this.mouthRaf = null
      }
    }

    tick()
  }

  resetMouth(vrm) {
    const resetMouth = () => {
      const aa = vrm.expressionManager.getValue('aa') || 0
      const ee = vrm.expressionManager.getValue('ee') || 0
      const oh = vrm.expressionManager.getValue('oh') || 0
      const smile = vrm.expressionManager.getValue('happy') || 0

      if (aa > 0.01 || ee > 0.01 || oh > 0.01 || smile > 0.01) {
        vrm.expressionManager.setValue('aa', Math.max(aa * 0.9, 0))
        vrm.expressionManager.setValue('ee', Math.max(ee * 0.9, 0))
        vrm.expressionManager.setValue('oh', Math.max(oh * 0.9, 0))
        vrm.expressionManager.setValue('happy', Math.max(smile * 0.95, 0))
        vrm.expressionManager.update()
        requestAnimationFrame(resetMouth)
      }
    }
    resetMouth()
  }

  cleanup() {
    if (this.mouthRaf) {
      cancelAnimationFrame(this.mouthRaf)
      this.mouthRaf = null
    }

    try {
      this.sourceNode?.disconnect()
      this.analyser?.disconnect()
    } catch {
      /* ignore */
    }

    this.sourceNode = null
    this.analyser = null

    if (this.audioCtx) {
      this.audioCtx.close()
      this.audioCtx = null
    }
  }
}
