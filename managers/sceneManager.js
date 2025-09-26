// sceneManager.js - Handles Three.js scene setup and rendering
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas
    this.renderer = null
    this.scene = null
    this.camera = null
    this.controls = null
    this.clock = new THREE.Clock()
    this.animationFrameId = null
    this.isRunning = false

    this.updateCallbacks = []
  }

  initialize() {
    try {
      // Initialize renderer
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        canvas: this.canvas,
        alpha: true
      })
      this.renderer.setSize(window.innerWidth, window.innerHeight)
      this.renderer.setPixelRatio(window.devicePixelRatio)
      this.renderer.shadowMap.enabled = true
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

      // Initialize scene
      this.scene = new THREE.Scene()

      // Initialize camera
      this.camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.1,
        100
      )
      this.camera.position.set(0, 1.4, 2.2)

      // Setup lighting
      this.setupLighting()

      // Initialize controls
      this.controls = new OrbitControls(this.camera, this.renderer.domElement)
      this.controls.target.set(0, 1.4, 0)
      this.controls.update()

      // Setup resize handler
      this.setupResizeHandler()

      console.log('✅ SceneManager initialized successfully')
      return true
    } catch (error) {
      console.error('❌ Failed to initialize SceneManager:', error)
      return false
    }
  }

  setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4)
    this.scene.add(ambientLight)

    // Main directional light
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8)
    mainLight.position.set(5, 10, 5)
    mainLight.castShadow = true
    mainLight.shadow.mapSize.width = 2048
    mainLight.shadow.mapSize.height = 2048
    mainLight.shadow.camera.near = 0.1
    mainLight.shadow.camera.far = 50
    mainLight.shadow.camera.left = -10
    mainLight.shadow.camera.right = 10
    mainLight.shadow.camera.top = 10
    mainLight.shadow.camera.bottom = -10
    this.scene.add(mainLight)

    // Fill light
    const fillLight = new THREE.DirectionalLight(0x8bb7ff, 0.3)
    fillLight.position.set(-5, 5, 5)
    this.scene.add(fillLight)

    console.log('🔆 Lighting setup complete')
  }

  setupResizeHandler() {
    const handleResize = () => {
      if (!this.camera || !this.renderer) return

      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener('resize', handleResize)

    // Store reference for cleanup
    this.resizeHandler = handleResize
  }

  addToScene(object) {
    if (this.scene && object) {
      this.scene.add(object)
    }
  }

  removeFromScene(object) {
    if (this.scene && object) {
      this.scene.remove(object)
    }
  }

  addUpdateCallback(callback) {
    if (typeof callback === 'function') {
      this.updateCallbacks.push(callback)
    }
  }

  removeUpdateCallback(callback) {
    const index = this.updateCallbacks.indexOf(callback)
    if (index > -1) {
      this.updateCallbacks.splice(index, 1)
    }
  }

  startRenderLoop() {
    if (this.isRunning) return

    this.isRunning = true

    const animate = () => {
      if (!this.isRunning) return

      const delta = this.clock.getDelta()

      // Update controls
      if (this.controls) {
        this.controls.update()
      }

      // Call all update callbacks
      this.updateCallbacks.forEach(callback => {
        try {
          callback(delta)
        } catch (error) {
          console.error('Update callback error:', error)
        }
      })

      // Render the scene
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera)
      }

      this.animationFrameId = requestAnimationFrame(animate)
    }

    animate()
    console.log('🎬 Render loop started')
  }

  stopRenderLoop() {
    this.isRunning = false
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
    console.log('⏹️ Render loop stopped')
  }

  setupDragAndDrop(onFileDropCallback) {
    if (!onFileDropCallback) return

    const handleDrop = async (event) => {
      event.preventDefault()
      const file = event.dataTransfer.files[0]

      if (file && file.name.endsWith('.vrm')) {
        try {
          await onFileDropCallback(file)
        } catch (error) {
          console.error('File drop error:', error)
        }
      }
    }

    const handleDragOver = (event) => {
      event.preventDefault()
    }

    window.addEventListener('drop', handleDrop)
    window.addEventListener('dragover', handleDragOver)

    // Store references for cleanup
    this.dropHandler = handleDrop
    this.dragOverHandler = handleDragOver
  }

  getCamera() {
    return this.camera
  }

  getScene() {
    return this.scene
  }

  getRenderer() {
    return this.renderer
  }

  getControls() {
    return this.controls
  }

  cleanup() {
    // Stop render loop
    this.stopRenderLoop()

    // Remove event listeners
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler)
    }
    if (this.dropHandler) {
      window.removeEventListener('drop', this.dropHandler)
    }
    if (this.dragOverHandler) {
      window.removeEventListener('dragover', this.dragOverHandler)
    }

    // Clear callbacks
    this.updateCallbacks = []

    // Dispose of Three.js objects
    if (this.renderer) {
      this.renderer.dispose()
      this.renderer = null
    }

    if (this.controls) {
      this.controls.dispose()
      this.controls = null
    }

    // Clear scene
    if (this.scene) {
      this.scene.clear()
      this.scene = null
    }

    this.camera = null
    this.canvas = null

    console.log('🧹 SceneManager cleanup complete')
  }
}
