// aiClient.js - Handles AI chat and animation planning
import { GoogleGenAI } from '@google/genai'

export class AIClient {
  constructor(apiKey) {
    this.client = new GoogleGenAI({
      apiKey: apiKey || 'AIzaSyCYkivW_PQEE3ayBSYTXw1mtnQiDMau7GM'
    })
    this.model = 'gemini-2.5-flash'
  }

  async chatWithAI(message, systemPrompt = '') {
    try {
      const prompt = systemPrompt
        ? `${systemPrompt}\n\nUser: ${message}`
        : message

      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
      })

      return response.candidates?.[0]?.content?.parts?.[0]?.text || '...no reply...'
    } catch (error) {
      console.error('Google Generative AI error:', error)
      return 'Sorry, something went wrong with the AI response.'
    }
  }

  async generateAnimationPlan(text) {
    const animPrompt = `
You are an advanced animation director for a VRM character with extensive animation capabilities.
Analyze the following text and create a detailed animation sequence.

⚠️ Return ONLY valid JSON (array of objects). Do not include explanations or code fences.

Available expressions: neutral, happy, sad, angry, surprised, excited, confused, smirk, laugh, embarrassed, determined, worried, curious, sleepy, mischievous

Available head motions: none, nod, shake, tiltLeft, tiltRight, lookUp, lookDown, doubleNod, confused

Available gestures: none, point, handWave, shrug, leanIn, crossArms, handToHeart, thumbsUp, facepalm, handToHip, stretch, clap, think, dance, talk, idle

SPECIAL GESTURES:
- dance: Triggers the Bling-Bang-Bang-Born dance animation (10+ seconds)
- talk: Uses talking animation during speech
- idle: Returns to happy idle animation

Each object MUST have:
- "text": the spoken phrase/sentence,
- "expression": choose the most appropriate expression,
- "headMotion": choose appropriate head movement,
- "gesture": choose appropriate gesture (use dance for celebratory moments, talk for conversations),
- "duration": milliseconds for this animation step,
- "intensity": 0.1-1.0 for animation strength

Consider:
- Use "dance" gesture for celebratory, fun, or energetic responses
- Use "talk" gesture during normal conversation
- Match expressions to emotional content
- Use gestures for emphasis, not every phrase
- Vary head motions naturally
- Time animations to speech rhythm
- Use lower intensity for subtle moments

Text to animate:
"""${text}"""
`

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [{ text: animPrompt }],
          },
        ],
      })

      let rawResponse = response.candidates?.[0]?.content?.parts?.[0]?.text || '[]'

      // Clean up the response
      rawResponse = rawResponse
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim()

      const animationPlan = JSON.parse(rawResponse)
      console.log('Generated animation plan:', animationPlan)

      return Array.isArray(animationPlan) ? animationPlan : [animationPlan]
    } catch (error) {
      console.error('Animation plan generation error:', error)

      // Fallback simple plan
      return [{
        text: text,
        expression: 'neutral',
        headMotion: 'none',
        gesture: 'none',
        duration: 2000,
        intensity: 0.5
      }]
    }
  }

  updateApiKey(newApiKey) {
    this.client = new GoogleGenAI({
      apiKey: newApiKey
    })
  }
}
