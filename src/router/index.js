import { Component } from 'lucide-vue-next'
import { createRouter, createWebHistory } from 'vue-router'
import Chat from '../App.vue'
const routes = [
  { path: '/', name: 'chat', Component: Chat },

  // Animation paths
  {
    path: '/animations/HappyIdle',
    name: 'happy-idle',
    meta: { file: '/animations/HappyIdle.fbx' },
  },
  { path: '/animations/Shrug.fbx', name: 'shrug', meta: { file: '/animations/Shrug.fbx' } },
  { path: '/animations/Waving.fbx', name: 'waving', meta: { file: '/animations/Waving.fbx' } },
  { path: '/animations/Clapping.fbx', name: 'waving', meta: { file: '/animations/Clapping.fbx' } },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
