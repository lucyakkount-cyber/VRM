// vrmLoader.js - Handles VRM model loading and animation conversion
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'

export class VRMLoader {
  constructor() {
    this.loader = new GLTFLoader()
    this.fbxLoader = new FBXLoader()
    this.loader.register((parser) => new VRMLoaderPlugin(parser))

    this.mixamoVRMRigMap = {
      mixamorigHips: 'hips',
      mixamorigSpine: 'spine',
      mixamorigSpine1: 'chest',
      mixamorigSpine2: 'upperChest',
      mixamorigNeck: 'neck',
      mixamorigHead: 'head',
      mixamorigLeftShoulder: 'leftShoulder',
      mixamorigLeftArm: 'leftUpperArm',
      mixamorigLeftForeArm: 'leftLowerArm',
      mixamorigLeftHand: 'leftHand',
      mixamorigRightShoulder: 'rightShoulder',
      mixamorigRightArm: 'rightUpperArm',
      mixamorigRightForeArm: 'rightLowerArm',
      mixamorigRightHand: 'rightHand',
      mixamorigLeftUpLeg: 'leftUpperLeg',
      mixamorigLeftLeg: 'leftLowerLeg',
      mixamorigLeftFoot: 'leftFoot',
      mixamorigRightUpLeg: 'rightUpperLeg',
      mixamorigRightLeg: 'rightLowerLeg',
      mixamorigRightFoot: 'rightFoot',
      mixamorigLeftToeBase: 'leftToes',
      mixamorigRightToeBase: 'rightToes',
    }
  }

  async loadVRMFromPath(path) {
    try {
      console.log('Loading VRM model from:', path)
      const gltf = await this.loader.loadAsync(path)
      const vrm = gltf.userData.vrm

      this.setupVRMModel(vrm)
      console.log('✅ VRM model loaded successfully')

      return vrm
    } catch (error) {
      console.error('❌ Failed to load VRM model:', error)
      throw error
    }
  }

  async loadVRMFromFile(file) {
    try {
      console.log('Loading VRM model from file:', file.name)
      const arrayBuffer = await file.arrayBuffer()
      const gltf = await this.loader.parseAsync(arrayBuffer, '', file.name)
      const vrm = gltf.userData.vrm

      this.setupVRMModel(vrm)
      console.log('✅ VRM model loaded from file successfully')

      return vrm
    } catch (error) {
      console.error('❌ Failed to load VRM model from file:', error)
      throw error
    }
  }

  setupVRMModel(vrm) {
    if (!vrm) return

    // Setup model transforms
    vrm.scene.rotation.y = Math.PI
    vrm.scene.scale.set(2, 2, 2)
    vrm.scene.position.set(0, -2, -0.5)
    vrm.scene.castShadow = true
    vrm.scene.receiveShadow = true

    // Remove unnecessary joints for performance
    VRMUtils.removeUnnecessaryJoints(vrm.scene)

    console.log('VRM model setup complete:', vrm.meta)
  }

  async loadAnimationFromFBX(fbxPath) {
    try {
      console.log('Loading FBX animation from:', fbxPath)
      const fbxAsset = await this.fbxLoader.loadAsync(fbxPath)
      const clip = THREE.AnimationClip.findByName(fbxAsset.animations, 'mixamo.com') || fbxAsset.animations[0]

      if (!clip) {
        throw new Error('No animation found in FBX file')
      }

      console.log('✅ FBX animation loaded:', fbxPath)
      return { clip, asset: fbxAsset }
    } catch (error) {
      console.error('❌ Failed to load FBX animation:', fbxPath, error)
      throw error
    }
  }

  async loadDefaultAnimations(vrm) {
    const animations = {}

    try {
      console.log('🎭 Loading default animations...')

      // Load idle animation
      try {
        const idleData = await this.loadAnimationFromFBX('/animations/HappyIdle.fbx')
        animations.idle = await this.convertMixamoClip(idleData.clip, idleData.asset, vrm)
        console.log('✅ Idle animation loaded')
      } catch (error) {
        console.warn('⚠️ Could not load idle animation:', error)
      }

      // Load gesture animations
      const gestureFiles = [
        { file: 'Wave.fbx', name: 'wave' },
        { file: 'Shrug.fbx', name: 'shrug' },
        { file: 'Pointing.fbx', name: 'pointing' },
        { file: 'Clapping.fbx', name: 'clapping' },
        { file: 'ThumbsUp.fbx', name: 'thumbsup' }
      ]

      for (const gesture of gestureFiles) {
        try {
          const gestureData = await this.loadAnimationFromFBX(`/animations/${gesture.file}`)
          animations[gesture.name] = await this.convertMixamoClip(gestureData.clip, gestureData.asset, vrm)
          console.log(`✅ ${gesture.name} gesture loaded`)
        } catch (error) {
          console.warn(`⚠️ Could not load ${gesture.file}:`, error)
        }
      }

      return animations
    } catch (error) {
      console.error('Error loading default animations:', error)
      return animations
    }
  }

  async convertMixamoClip(clip, asset, vrm) {
    const tracks = []
    const restRotationInverse = new THREE.Quaternion()
    const parentRestWorldRotation = new THREE.Quaternion()
    const _quatA = new THREE.Quaternion()
    const _vec3 = new THREE.Vector3()

    const motionHipsHeight = asset.getObjectByName('mixamorigHips').position.y
    const vrmHipsY = vrm.humanoid?.getNormalizedBoneNode('hips').getWorldPosition(_vec3).y
    const vrmRootY = vrm.scene.getWorldPosition(_vec3).y
    const vrmHipsHeight = Math.abs(vrmHipsY - vrmRootY)
    const hipsPositionScale = vrmHipsHeight / motionHipsHeight

    clip.tracks.forEach((track) => {
      const trackSplitted = track.name.split('.')
      const mixamoRigName = trackSplitted[0]
      const vrmBoneName = this.mixamoVRMRigMap[mixamoRigName]
      const vrmNodeName = vrm.humanoid?.getNormalizedBoneNode(vrmBoneName)?.name
      const mixamoRigNode = asset.getObjectByName(mixamoRigName)

      if (vrmNodeName != null) {
        const propertyName = trackSplitted[1]

        mixamoRigNode.getWorldQuaternion(restRotationInverse).invert()
        mixamoRigNode.parent.getWorldQuaternion(parentRestWorldRotation)

        if (track instanceof THREE.QuaternionKeyframeTrack) {
          for (let i = 0; i < track.values.length; i += 4) {
            const flatQuaternion = track.values.slice(i, i + 4)
            _quatA.fromArray(flatQuaternion)
            _quatA.premultiply(parentRestWorldRotation).multiply(restRotationInverse)
            _quatA.toArray(flatQuaternion)
            flatQuaternion.forEach((v, index) => {
              track.values[index + i] = v
            })
          }

          tracks.push(
            new THREE.QuaternionKeyframeTrack(
              `${vrmNodeName}.${propertyName}`,
              track.times,
              track.values.map((v, i) => (vrm.meta?.metaVersion === '0' && i % 2 === 0 ? -v : v)),
            ),
          )
        } else if (track instanceof THREE.VectorKeyframeTrack) {
          const value = track.values.map(
            (v, i) => (vrm.meta?.metaVersion === '0' && i % 3 !== 1 ? -v : v) * hipsPositionScale,
          )

          if (vrmBoneName === 'hips' && propertyName === 'position') {
            for (let i = 0; i < value.length; i += 3) {
              value[i] = 0
              value[i + 2] = 0
            }
          }

          tracks.push(
            new THREE.VectorKeyframeTrack(`${vrmNodeName}.${propertyName}`, track.times, value),
          )
        }
      }
    })

    return new THREE.AnimationClip('vrmAnimation', clip.duration, tracks)
  }

  cleanupVRM(vrm) {
    if (!vrm) return

    vrm.scene.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose())
        } else {
          child.material?.dispose()
        }
      }
    })
  }
}
