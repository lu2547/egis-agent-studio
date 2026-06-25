import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'

// 从宿主业务项目仓库根加载 .env（frontend -> studio -> egis-gpt-agents）。
// 未显式声明 VITE_ 前缀，因此用第三个参数 '' 放开所有变量。
// 这些变量仅在 vite.config.ts 启动时读取，不会注入到前端运行时。
export default defineConfig(({ mode }) => {
    const envDir = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../')
    const env = loadEnv(mode, envDir, '')

    const frontendPort = Number(env.STUDIO_FRONTEND_PORT || 30080)
    const apiPort = env.API_PORT || '38081'
    // API_HOST 用于服务绑定（如 0.0.0.0），不是客户端可访问地址，降级到 localhost。
    const apiHost = env.API_HOST && env.API_HOST !== '0.0.0.0' ? env.API_HOST : 'localhost'
    const backendUrl = `http://${apiHost}:${apiPort}`

    return {
        plugins: [vue()],
        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url))
            }
        },
        server: {
            port: frontendPort,
            proxy: {
                // ark 原生 chat 路由在 /chat（非 /api/chat），需要 rewrite
                '/api/chat': {
                    target: backendUrl,
                    changeOrigin: true,
                    rewrite: (path: string) => path.replace(/^\/api/, '')
                },
                // Studio / Agents / RAG 路由由 EgisStudioPlugin 提供，路径不变
                '/api/studio': {
                    target: backendUrl,
                    changeOrigin: true
                },
                '/api/agents': {
                    target: backendUrl,
                    changeOrigin: true
                },
                '/api/rag': {
                    target: backendUrl,
                    changeOrigin: true
                }
            }
        }
    }
})
