import axios from 'axios'

const api = axios.create({
    baseURL: '/api',
    timeout: 30000
})

// 获取 Agent 列表
export function getAgents() {
    return api.get('/agents')
}

// 获取 Agent 依赖的 tools【用于判断是否启用 RAG 选择器】
export interface AgentTool {
    name: string
    description?: string
}
export function getAgentTools(agentId: string) {
    return api.get<{ tools: AgentTool[] }>(`/agents/${agentId}/tools`)
}

// 获取 Chat 列表
export function getChats() {
    return api.get('/studio/chats')
}

// 创建新 Chat
export function createChat(agentId: string, title: string) {
    return api.post('/studio/chats', { agent_id: agentId, title })
}

// 获取 Chat 详情和消息
export function getChatDetail(chatId: string) {
    return api.get(`/studio/chats/${chatId}`)
}

// 发送消息
export function sendChatMessage(chatId: string, message: string) {
    return api.post(`/studio/chats/${chatId}/messages`, { message })
}

// 删除 Chat
export function deleteChat(chatId: string) {
    return api.delete(`/studio/chats/${chatId}`)
}

// 更新 Chat 标题或 agent
export function updateChat(chatId: string, title?: string, agentId?: string) {
    return api.put(`/studio/chats/${chatId}`, { title, agent_id: agentId })
}

// 回写 ark_agentic 的真实 session_id 映射（第一次 SSE 返回后调用）
export function updateChatAgentSession(chatId: string, agentSessionId: string) {
    return api.put(`/studio/chats/${chatId}`, { agent_session_id: agentSessionId })
}

// ===== RAG 名称查询（知识库/标签/文档选择器候选源）=====
// 后端（studio/backend）接收逗号分隔的 query string，这里统一在前端序列化。

function toCSV(v?: string[]): string | undefined {
    if (!v || v.length === 0) return undefined
    return v.join(',')
}

export interface RAGKnowledgeBase {
    id: string
    name: string
    category: string
    owner: string
    created_at: string
}

export interface RAGTag {
    id: string
    name: string
    knowledge_base_id: string
    owner: string
    created_at: string
}

export interface RAGFile {
    id: string
    title: string
    file_name: string
    file_type: string
    knowledge_base_id: string
    tag_id: string
    created_at: string
}

export interface RAGListResp<T> {
    items: T[]
    count: number
}

// GET /api/rag/knowledge_bases?names=&ids=&categories=&limit=
export function listKnowledgeBases(params: {
    names?: string[]
    ids?: string[]
    categories?: string[]
    limit?: number
} = {}) {
    return api.get<RAGListResp<RAGKnowledgeBase>>('/rag/knowledge_bases', {
        params: {
            names: toCSV(params.names),
            ids: toCSV(params.ids),
            categories: toCSV(params.categories),
            limit: params.limit,
        },
    })
}

// GET /api/rag/tags?names=&kb_ids=&limit=
export function listTags(params: {
    names?: string[]
    kb_ids?: string[]
    limit?: number
} = {}) {
    return api.get<RAGListResp<RAGTag>>('/rag/tags', {
        params: {
            names: toCSV(params.names),
            kb_ids: toCSV(params.kb_ids),
            limit: params.limit,
        },
    })
}

// GET /api/rag/files?names=&kb_ids=&limit=
export function listFiles(params: {
    names?: string[]
    kb_ids?: string[]
    limit?: number
} = {}) {
    return api.get<RAGListResp<RAGFile>>('/rag/files', {
        params: {
            names: toCSV(params.names),
            kb_ids: toCSV(params.kb_ids),
            limit: params.limit,
        },
    })
}

// ===== Chunk 详情（引用标签 hover 浮层）=====

export interface ChunkDetail {
    id: string
    content: string
    knowledge_id: string
    chunk_index: number
}

export interface KnowledgeChunk {
    id: string
    content: string
    knowledge_id: string
    chunk_index: number
}

// GET /api/rag/chunks/:id
export function getChunkById(chunkId: string) {
    return api.get<{ data: ChunkDetail }>(`/rag/chunks/${chunkId}`)
}

// GET /api/rag/knowledge/:id/chunks
export function getKnowledgeChunks(knowledgeId: string, limit = 1000) {
    return api.get<RAGListResp<KnowledgeChunk>>(`/rag/knowledge/${knowledgeId}/chunks`, {
        params: { limit },
    })
}
