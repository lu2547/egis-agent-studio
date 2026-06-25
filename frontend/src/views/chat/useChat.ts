/**
 * 聊天核心 composable
 *
 * 封装：Agent 加载、对话创建/加载、发送消息（SSE 流）、消息持久化。
 * 依赖：streamParser (SSE 事件调度)、useRag (RAG 增量同步)、messageHelpers (isMinimalMode)
 */

import { ref, inject, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
    getAgents,
    createChat,
    getChatDetail,
    updateChat,
    updateChatAgentSession,
} from '@/api'
import { handleSSEEvent, type StreamContext } from './streamParser'

export type RunMode = 'flash' | 'pro'

export interface UseChatOptions {
    /** RAG composable 提供的增量同步方法 */
    getRagChanged: () => { changed: boolean; hash: string }
    markRagSynced: (hash: string) => void
    resetRagHash: () => void
    ragState: { knowledge_base_ids: string[]; tag_ids: string[]; file_ids: string[] }
    detectAgentRagDeps: (agentId: string) => Promise<void>
}

const RUN_MODE_STORAGE_KEY = 'egis-studio:run-mode'

function readInitialRunMode(): RunMode {
    const value = window.localStorage.getItem(RUN_MODE_STORAGE_KEY)
    return value === 'flash' || value === 'pro' ? value : 'pro'
}

export function useChat(opts: UseChatOptions) {
    const route = useRoute()
    const router = useRouter()

    // 从 Layout 注入共享状态
    const currentChatId = inject<any>('currentChatId', ref(''))
    const loadChats = inject<() => Promise<void>>('loadChats', async () => { })

    // 本地状态
    const agents = ref<any[]>([])
    const selectedAgent = ref('')
    const messages = ref<any[]>([])
    const inputValue = ref('')
    const runMode = ref<RunMode>(readInitialRunMode())
    const isLoading = ref(false)
    const messageContainer = ref<HTMLElement | null>(null)
    const abortController = ref<AbortController | null>(null)
    const agentSessionId = ref<string>('')
    const lastActiveChatId = ref<string>('')  // 记住最近活跃的 chat，防止意外导航丢失 session

    watch(runMode, (mode) => {
        window.localStorage.setItem(RUN_MODE_STORAGE_KEY, mode)
    })

    // === 加载 ===

    async function loadAgents() {
        try {
            const res = await getAgents()
            agents.value = res.data.agents || []
        } catch (err) {
            console.error('Failed to load agents:', err)
        }
    }

    async function loadChatDetail(chatId: string) {
        try {
            const res = await getChatDetail(chatId)
            messages.value = (res.data.messages || []).map((m: any) => ({
                role: m.role,
                content: m.content || '',
                reasoning: m.reasoning || '',
                todoCard: m.todoCard || null,
                outlineCard: m.outlineCard || null,
                entryCard: m.entryCard || null,
                isStreaming: false,
                elapsed: m.elapsed || 0,
            }))
            if (res.data.chat?.agent_id) {
                selectedAgent.value = res.data.chat.agent_id
                await opts.detectAgentRagDeps(selectedAgent.value)
            }
            agentSessionId.value = res.data.chat?.agent_session_id || ''
            lastActiveChatId.value = chatId
            opts.resetRagHash()
            scrollToBottom()
        } catch (err) {
            console.error('Failed to load chat detail:', err)
        }
    }

    // === 新建对话 ===

    async function createNewChatInline(): Promise<string> {
        const agentId = selectedAgent.value || (agents.value[0]?.id ?? '')
        const res = await createChat(agentId, '')
        const newId = res.data.id
        agentSessionId.value = ''
        opts.resetRagHash()
        await router.push(`/chat/${newId}`)
        await loadChats()
        return newId
    }

    // === Agent 变更 ===

    async function onAgentChange() {
        await opts.detectAgentRagDeps(selectedAgent.value)
        if (currentChatId.value && selectedAgent.value) {
            try {
                await updateChat(currentChatId.value, undefined, selectedAgent.value)
            } catch (err) {
                console.error('Failed to update chat agent:', err)
            }
        }
    }

    // === 发送消息 ===

    async function sendMessage() {
        if (!inputValue.value.trim() || isLoading.value) return

        const query = inputValue.value
        inputValue.value = ''
        isLoading.value = true

        // 确保有 chatId，显式捕获避免长流结束后 computed 失效
        let chatId = currentChatId.value
        if (!chatId && lastActiveChatId.value) {
            // 用户意外导航到 /chat（无ID），但有活跃 session —— 恢复到上次的 chat
            chatId = lastActiveChatId.value
            await router.push(`/chat/${chatId}`)
        }
        if (!chatId) {
            try {
                chatId = await createNewChatInline()
            } catch (err) {
                console.error('create chat failed:', err)
                isLoading.value = false
                inputValue.value = query
                return
            }
        }

        messages.value.push({ role: 'user', content: query })

        const startTime = Date.now()
        messages.value.push({
            role: 'assistant',
            content: '',
            reasoning: '',
            todoCard: null,
            outlineCard: null,
            entryCard: null,
            a2uiCards: [],
            svgPages: [],
            isStreaming: true,
            elapsed: 0,
        })
        const assistantIdx = messages.value.length - 1
        scrollToBottom()

        try {
            abortController.value = new AbortController()

            const { changed: ragChanged, hash: currentRagHash } = opts.getRagChanged()

            const body: any = {
                agent_id: selectedAgent.value,
                message: query,
                session_id: agentSessionId.value || undefined,
                stream: true,
                protocol: 'agui',
                user_id: 'studio-user',
                context: {
                    run_mode: runMode.value,
                },
            }
            if (ragChanged) {
                body.context = {
                    ...body.context,
                    rag_state: {
                        knowledge_base_ids: opts.ragState.knowledge_base_ids,
                        tag_ids: opts.ragState.tag_ids,
                        file_ids: opts.ragState.file_ids,
                        hash: currentRagHash,
                    },
                }
            }

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: abortController.value.signal,
            })

            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            if (ragChanged) opts.markRagSynced(currentRagHash)
            const reader = response.body?.getReader()
            if (!reader) throw new Error('No response body')

            const decoder = new TextDecoder()
            let buffer = ''

            const ctx: StreamContext = {
                msg: messages.value[assistantIdx],
                startTime,
                agentSessionId: agentSessionId.value,
                currentChatId: chatId,
                onSessionId: (id) => {
                    agentSessionId.value = id
                    if (chatId) {
                        updateChatAgentSession(chatId, id).catch((e) => {
                            console.warn('updateChatAgentSession failed:', e)
                        })
                    }
                },
                onScroll: scrollToBottom,
            }

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (!line.trim()) continue
                    if (!line.startsWith('data:')) continue
                    try {
                        const d = JSON.parse(line.slice(5).trim())
                        ctx.msg = messages.value[assistantIdx] // 确保引用最新
                        handleSSEEvent(d, ctx)
                    } catch (e) {
                        console.error('SSE parse error:', e, line)
                    }
                }
            }

            // 兜底复位
            const msg = messages.value[assistantIdx]
            msg.isStreaming = false
            if (!msg.elapsed) msg.elapsed = Math.max(1, Math.round((Date.now() - startTime) / 1000))

            await saveMessagesToBackend(chatId, query, msg.content || '', assistantIdx)
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error('sendMessage error:', err)
                const msg = messages.value[assistantIdx]
                msg.content = (msg.content || '') + `\n\n**发送失败:** ${err.message}`
                msg.isStreaming = false
            }
        } finally {
            isLoading.value = false
        }
    }

    // === 保存消息 ===

    async function saveMessagesToBackend(chatId: string, userMsg: string, assistantMsg: string, assistantIdx: number) {
        if (!chatId) return
        try {
            await fetch(`/api/studio/chats/${chatId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg }),
            })
            const amsg = messages.value[assistantIdx]
            if (assistantMsg || amsg?.reasoning || amsg?.todoCard || amsg?.outlineCard || amsg?.entryCard) {
                await fetch(`/api/studio/chats/${chatId}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: assistantMsg,
                        role: 'assistant',
                        reasoning: amsg?.reasoning || '',
                        todoCard: amsg?.todoCard || null,
                        outlineCard: amsg?.outlineCard || null,
                        entryCard: amsg?.entryCard || null,
                        elapsed: amsg?.elapsed || 0,
                    }),
                })
            }
            await loadChats()
        } catch (err) {
            console.error('save msgs failed:', err)
        }
    }

    // === 工具 ===

    function scrollToBottom() {
        setTimeout(() => {
            if (messageContainer.value) {
                messageContainer.value.scrollTop = messageContainer.value.scrollHeight
            }
        }, 50)
    }

    function handleKeyDown(_val: string, context: { e: KeyboardEvent }) {
        const e = context?.e
        if (!e) return
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            sendMessage()
        }
    }

    return {
        // 注入的共享状态
        currentChatId,
        // 本地状态
        agents,
        selectedAgent,
        messages,
        inputValue,
        runMode,
        isLoading,
        messageContainer,
        agentSessionId,
        // 方法
        loadAgents,
        loadChatDetail,
        onAgentChange,
        sendMessage,
        handleKeyDown,
        scrollToBottom,
        // 路由
        route,
    }
}
