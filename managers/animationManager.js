// animationManager.js - Handles all VRM animations
import * as THREE from 'three'

export class AnimationManager {
  constructor(vrm) {
    this.vrm = vrm
    this.currentMixer = null
    this.currentAnimationAction = null
    this.idleAnimation = null
    this.gestureAnimations = {}
    this.blinkInterval = null
    this.gestureTimeout = null

    this.EXPRESSIONS = {
      neutral: 0,
      happy: ['happy', 'joy'],
      sad: ['sad', 'sorrow'],
      angry: ['angry', 'fury'],
      surprised: ['surprised', 'shocked'],
      excited: ['excited', 'happy'],
      confused: ['confused', 'sad'],
      smirk: ['smirk', 'happy'],
      laugh: ['happy', 'joy'],
      embarrassed: ['blink', 'happy'],
      determined: ['angry'],
      worried: ['sad', 'blink'],
      curious: ['surprised'],
      sleepy: ['relaxed', 'blink'],
      mischievous: ['smirk', 'wink']
    }

    this.GESTURES = {
      none: null,
      point: 'point',
      handWave: 'wave',
      shrug: 'shrug',
      leanIn: 'leanIn',
      crossArms: 'crossArms',
      handToHeart: 'heartGesture',
      thumbsUp: 'thumbsUp',
      facepalm: 'facepalm',
      handToHip: 'handToHip',
      stretch: 'stretch',
      clap: 'clap',
      think: 'thinkGesture'
    }
  }

  updateVRM(newVrm) {
    this.vrm = newVrm
    this.cleanup()
    this.startBlinking()
  }

  setIdleAnimation(animation) {
    this.idleAnimation = animation
  }

  setGestureAnimation(name, animation) {
    this.gestureAnimations[name] = animation
  }

  startIdleAnimation() {
    if (!this.vrm || !this.idleAnimation) return

    if (this.currentAnimationAction) {
      this.currentAnimationAction.stop()
    }

    this.currentMixer = new THREE.AnimationMixer(this.vrm.scene)
    this.currentAnimationAction = this.currentMixer.clipAction(this.idleAnimation)
    this.currentAnimationAction.setLoop(THREE.LoopRepeat)
    this.currentAnimationAction.reset()
    this.currentAnimationAction.play()
  }

  lerpExpression(expression, target, duration = 400) {
    if (!this.vrm?.expressionManager) return

    const expressions = this.EXPRESSIONS[expression] || [expression]

    expressions.forEach(expr => {
      const start = this.vrm.expressionManager.getValue(expr) || 0
      const startTime = performance.now()

      const step = (now) => {
        const t = Math.min((now - startTime) / duration, 1)
        const eased = t * (2 - t) // ease out
        const value = start + (target - start) * eased
        this.vrm.expressionManager.setValue(expr, value)
        this.vrm.expressionManager.update()
        if (t < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    })
  }

  animateHeadMotion(type, duration = 600) {
    if (!this.vrm) return
    const head = this.vrm.humanoid?.getNormalizedBoneNode('head')
    if (!head) return

    const startRot = head.rotation.clone()
    let targetRot = new THREE.Euler()
    let animationCurve = Math.sin

    switch (type) {
      case 'nod':
        targetRot.set(0.4, 0, 0)
        break
      case 'shake':
        targetRot.set(0, 0.4, 0)
        animationCurve = (t) => Math.sin(t * Math.PI * 2) * 0.5
        break
      case 'tiltLeft':
        targetRot.set(0, 0, 0.25)
        break
      case 'tiltRight':
        targetRot.set(0, 0, -0.25)
        break
      case 'lookUp':
        targetRot.set(-0.3, 0, 0)
        break
      case 'lookDown':
        targetRot.set(0.3, 0, 0)
        break
      case 'doubleNod':
        animationCurve = (t) => Math.sin(t * Math.PI * 4) * 0.5
        targetRot.set(0.3, 0, 0)
        duration *= 1.5
        break
      case 'confused':
        animationCurve = (t) => Math.sin(t * Math.PI * 3) * 0.3
        targetRot.set(0, 0.2, 0.1)
        break
    }

    const startTime = performance.now()
    const step = (now) => {
      const t = Math.min((now - startTime) / duration, 1)
      const eased = animationCurve(t * Math.PI)
      head.rotation.x = startRot.x + (targetRot.x - startRot.x) * eased
      head.rotation.y = startRot.y + (targetRot.y - startRot.y) * eased
      head.rotation.z = startRot.z + (targetRot.z - startRot.z) * eased
      if (t < 1) requestAnimationFrame(step)
      else head.rotation.copy(startRot)
    }
    requestAnimationFrame(step)
  }

  performGesture(gestureType, duration = 1000) {
    if (!this.vrm || !gestureType || gestureType === 'none') return

    // Clear any existing gesture timeout
    if (this.gestureTimeout) clearTimeout(this.gestureTimeout)

    // Check if we have a loaded animation for this gesture
    if (this.gestureAnimations[gestureType]) {
      this.playGestureAnimation(gestureType)
      return
    }

    // Fallback to procedural gestures
    const leftArm = this.vrm.humanoid?.getNormalizedBoneNode('leftUpperArm')
    const rightArm = this.vrm.humanoid?.getNormalizedBoneNode('rightUpperArm')
    const leftForearm = this.vrm.humanoid?.getNormalizedBoneNode('leftLowerArm')
    const rightForearm = this.vrm.humanoid?.getNormalizedBoneNode('rightLowerArm')
    const spine = this.vrm.humanoid?.getNormalizedBoneNode('spine')

    if (!leftArm || !rightArm) return

    const startPositions = {
      leftArm: leftArm.rotation.clone(),
      rightArm: rightArm.rotation.clone(),
      leftForearm: leftForearm?.rotation.clone(),
      rightForearm: rightForearm?.rotation.clone(),
      spine: spine?.rotation.clone()
    }

    let gestureAnimation

    switch (gestureType) {
      case 'shrug':
        gestureAnimation = (t) => {
          const intensity = Math.sin(t * Math.PI) * 0.8
          leftArm.rotation.z = startPositions.leftArm.z + intensity
          rightArm.rotation.z = startPositions.rightArm.z - intensity
          leftArm.rotation.x = startPositions.leftArm.x - intensity * 0.3
          rightArm.rotation.x = startPositions.rightArm.x - intensity * 0.3
          if (spine) spine.rotation.y = Math.sin(t * Math.PI * 2) * 0.1
        }
        break

      case 'point':
        gestureAnimation = (t) => {
          const intensity = Math.sin(t * Math.PI) * 0.9
          rightArm.rotation.x = startPositions.rightArm.x - intensity * 1.2
          rightArm.rotation.z = startPositions.rightArm.z - intensity * 0.5
          if (rightForearm) rightForearm.rotation.x = intensity * 0.8
        }
        break

      case 'handWave':
        gestureAnimation = (t) => {
          const wave = Math.sin(t * Math.PI * 6) * 0.4
          const lift = Math.sin(t * Math.PI) * 1.2
          rightArm.rotation.x = startPositions.rightArm.x - lift
          rightArm.rotation.z = startPositions.rightArm.z - 0.8 + wave
          if (rightForearm) rightForearm.rotation.y = wave * 0.5
        }
        break

      case 'crossArms':
        gestureAnimation = (t) => {
          const intensity = Math.sin(t * Math.PI) * 0.7
          leftArm.rotation.y = startPositions.leftArm.y + intensity
          rightArm.rotation.y = startPositions.rightArm.y - intensity
          leftArm.rotation.x = startPositions.leftArm.x - intensity * 0.5
          rightArm.rotation.x = startPositions.rightArm.x - intensity * 0.5
        }
        break

      case 'handToHeart':
        gestureAnimation = (t) => {
          const intensity = Math.sin(t * Math.PI) * 0.8
          rightArm.rotation.x = startPositions.rightArm.x - intensity * 0.8
          rightArm.rotation.y = startPositions.rightArm.y + intensity * 0.4
          rightArm.rotation.z = startPositions.rightArm.z + intensity * 0.3
        }
        break

      case 'think':
        gestureAnimation = (t) => {
          const intensity = Math.sin(t * Math.PI) * 0.6
          rightArm.rotation.x = startPositions.rightArm.x - intensity * 1.1
          rightArm.rotation.y = startPositions.rightArm.y + intensity * 0.2
          if (rightForearm) rightForearm.rotation.x = intensity * 1.2
          this.animateHeadMotion('tiltLeft', duration * 0.8)
        }
        break

      default:
        return
    }

    const startTime = performance.now()
    const step = (now) => {
      const t = Math.min((now - startTime) / duration, 1)
      gestureAnimation(t)

      if (t < 1) {
        requestAnimationFrame(step)
      } else {
        // Reset to original positions
        leftArm.rotation.copy(startPositions.leftArm)
        rightArm.rotation.copy(startPositions.rightArm)
        if (leftForearm) leftForearm.rotation.copy(startPositions.leftForearm)
        if (rightForearm) rightForearm.rotation.copy(startPositions.rightForearm)
        if (spine) spine.rotation.copy(startPositions.spine)
      }
    }
    requestAnimationFrame(step)
  }

  playGestureAnimation(gestureType) {
    if (!this.currentMixer || !this.gestureAnimations[gestureType]) return

    const gestureAction = this.currentMixer.clipAction(this.gestureAnimations[gestureType])
    gestureAction.setLoop(THREE.LoopOnce)
    gestureAction.clampWhenFinished = true
    gestureAction.reset()
    gestureAction.play()

    this.gestureTimeout = setTimeout(() => {
      gestureAction.fadeOut(0.5)
    }, this.gestureAnimations[gestureType].duration * 1000)
  }

  startBlinking() {
    if (!this.vrm?.expressionManager) return
    if (this.blinkInterval) clearTimeout(this.blinkInterval)

    const doBlink = () => {
      if (!this.vrm?.expressionManager) return

      const intensity = 0.8 + Math.random() * 0.2
      const duration = 120 + Math.random() * 80

      this.vrm.expressionManager.setValue('blink', intensity)
      this.vrm.expressionManager.update()

      setTimeout(() => {
        this.vrm.expressionManager.setValue('blink', 0.0)
        this.vrm.expressionManager.update()

        const nextBlink = 2000 + Math.random() * 4000
        this.blinkInterval = setTimeout(doBlink, nextBlink)
      }, duration)
    }
    doBlink()
  }

  async playAnimationSequence(plan) {
    if (!this.vrm?.expressionManager || !plan.length) return

    console.log('Playing animation sequence:', plan.length, 'steps')

    for (let i = 0; i < plan.length; i++) {
      const step = plan[i]
      const intensity = (step.intensity || 0.7) * 0.6

      console.log(`Animation step ${i + 1}:`, step)

      const animations = []
      const transitionTime = 600

      // Expression animation
      if (step.expression && step.expression !== 'neutral') {
        animations.push(
          new Promise((resolve) => {
            this.lerpExpression(step.expression, intensity, transitionTime)
            setTimeout(resolve, transitionTime * 0.3)
          })
        )
      }

      // Head motion
      if (step.headMotion && step.headMotion !== 'none') {
        animations.push(
          new Promise((resolve) => {
            this.animateHeadMotion(step.headMotion, Math.min(step.duration * 1.2, 1200))
            setTimeout(resolve, 200)
          })
        )
      }

      // Gesture
      if (step.gesture && step.gesture !== 'none') {
        animations.push(
          new Promise((resolve) => {
            this.performGesture(step.gesture, Math.min(step.duration * 1.5, 2000))
            setTimeout(resolve, 300)
          })
        )
      }

      // Wait for step duration
      const stepDuration = Math.max(step.duration, 800)
      await Promise.all([
        ...animations,
        new Promise(r => setTimeout(r, stepDuration))
      ])

      // Fade out expression
      if (step.expression && step.expression !== 'neutral') {
        this.lerpExpression(step.expression, 0.0, transitionTime * 1.2)
      }

      // Pause between steps
      if (i < plan.length - 1) {
        await new Promise(r => setTimeout(r, 200 + Math.random() * 200))
      }
    }

    console.log('Animation sequence complete')
  }

  update(delta) {
    if (this.currentMixer) {
      this.currentMixer.update(delta)
    }
  }

  cleanup() {
    if (this.blinkInterval) {
      clearTimeout(this.blinkInterval)
      this.blinkInterval = null
    }

    if (this.gestureTimeout) {
      clearTimeout(this.gestureTimeout)
      this.gestureTimeout = null
    }

    if (this.currentMixer) {
      this.currentMixer.stopAllAction()
      this.currentMixer = null
    }

    this.currentAnimationAction = null
  }
}
