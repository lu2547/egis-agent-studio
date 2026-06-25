import { createRouter, createWebHistory } from 'vue-router'
import Layout from './Layout.vue'

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            component: Layout,
            redirect: '/chat',
            children: [
                {
                    path: '/chat/:id?',
                    component: () => import('./views/chat/ChatView.vue')
                },
                {
                    path: '/agents',
                    component: () => import('./views/AgentStudio.vue')
                }
            ]
        }
    ]
})

export default router
