/**
 * RAG 选择器 composable
 *
 * 封装知识库/标签/文档的加载与交互逻辑。
 * 返回响应式状态 + 事件处理函数，供 template 直接绑定。
 */

import { ref, reactive } from 'vue'
import {
  getAgentTools,
  listKnowledgeBases,
  listTags,
  listFiles,
  type RAGKnowledgeBase,
  type RAGTag,
  type RAGFile,
} from '@/api'

const RAG_TOOL_NAMES = new Set([
  'rag',
  'rag_retrieval',
  'knowledge_search',
  'grep_chunks',
  'select_documents',
  'get_document_info',
  'list_knowledge_chunks',
])

export function useRag() {
  // === 状态 ===
  const ragState = reactive({
    knowledge_base_ids: [] as string[],
    tag_ids: [] as string[],
    file_ids: [] as string[],
  })

  const kbOptions = ref<RAGKnowledgeBase[]>([])
  const tagOptions = ref<RAGTag[]>([])
  const fileOptions = ref<RAGFile[]>([])
  const kbLoading = ref(false)
  const tagLoading = ref(false)
  const fileLoading = ref(false)
  const agentUsesRag = ref(false)

  // hash 增量同步
  let lastSentRagHash: string | null = null

  // === 方法 ===

  function computeRagHash(): string {
    const norm = {
      k: [...ragState.knowledge_base_ids].sort(),
      t: [...ragState.tag_ids].sort(),
      f: [...ragState.file_ids].sort(),
    }
    return JSON.stringify(norm)
  }

  function getRagChanged(): { changed: boolean; hash: string } {
    const h = computeRagHash()
    return { changed: h !== lastSentRagHash, hash: h }
  }

  function markRagSynced(hash: string) {
    lastSentRagHash = hash
  }

  function resetRagHash() {
    lastSentRagHash = null
  }

  async function detectAgentRagDeps(agentId: string) {
    if (!agentId) {
      agentUsesRag.value = false
      return
    }
    try {
      const res = await getAgentTools(agentId)
      const tools = res.data.tools || []
      agentUsesRag.value = tools.some((t: any) => RAG_TOOL_NAMES.has(t.name))
    } catch (err) {
      console.error('getAgentTools failed:', err)
      agentUsesRag.value = false
    }
  }

  async function loadKbDefaults() {
    kbLoading.value = true
    try {
      const res = await listKnowledgeBases({ limit: 500 })
      kbOptions.value = res.data.items || []
    } catch (err) {
      console.error('listKnowledgeBases failed:', err)
    } finally {
      kbLoading.value = false
    }
  }

  async function onKbSearch(keyword: string) {
    if (!keyword || !keyword.trim()) {
      await loadKbDefaults()
      return
    }
    kbLoading.value = true
    try {
      const res = await listKnowledgeBases({ names: [keyword.trim()], limit: 50 })
      const incoming = res.data.items || []
      const map = new Map<string, RAGKnowledgeBase>()
      for (const k of kbOptions.value) {
        if (ragState.knowledge_base_ids.includes(k.id)) map.set(k.id, k)
      }
      for (const k of incoming) map.set(k.id, k)
      kbOptions.value = Array.from(map.values())
    } catch (err) {
      console.error('listKnowledgeBases search failed:', err)
    } finally {
      kbLoading.value = false
    }
  }

  async function onKbChange() {
    if (ragState.knowledge_base_ids.length === 0) {
      tagOptions.value = []
      ragState.tag_ids = []
      return
    }
    tagLoading.value = true
    try {
      const res = await listTags({ kb_ids: ragState.knowledge_base_ids, limit: 500 })
      tagOptions.value = res.data.items || []
      const validIds = new Set(tagOptions.value.map((t) => t.id))
      ragState.tag_ids = ragState.tag_ids.filter((id) => validIds.has(id))
    } catch (err) {
      console.error('listTags failed:', err)
    } finally {
      tagLoading.value = false
    }
  }

  async function onFileSearch(keyword: string) {
    if (!keyword || !keyword.trim()) {
      fileOptions.value = []
      return
    }
    fileLoading.value = true
    try {
      const res = await listFiles({ names: [keyword.trim()], limit: 50 })
      const incoming = res.data.items || []
      const map = new Map<string, RAGFile>()
      for (const f of fileOptions.value) {
        if (ragState.file_ids.includes(f.id)) map.set(f.id, f)
      }
      for (const f of incoming) map.set(f.id, f)
      fileOptions.value = Array.from(map.values())
    } catch (err) {
      console.error('listFiles search failed:', err)
    } finally {
      fileLoading.value = false
    }
  }

  // 禁用 t-select 对文档选项的本地过滤
  const filterFileLocal = () => true

  // 统一控制下拉面板
  const selectPopupProps = {
    overlayClassName: 'rag-select-popup',
    overlayInnerStyle: { maxWidth: '480px', overflowX: 'auto' },
  }

  function kbCategoryLabel(category?: string): string {
    switch (category) {
      case 'personal': return '个人'
      case 'public': return '公共'
      case 'enterprise':
      case 'owner': return '属主'
      default: return category || '未分类'
    }
  }

  return {
    ragState,
    kbOptions,
    tagOptions,
    fileOptions,
    kbLoading,
    tagLoading,
    fileLoading,
    agentUsesRag,
    filterFileLocal,
    selectPopupProps,
    getRagChanged,
    markRagSynced,
    resetRagHash,
    detectAgentRagDeps,
    loadKbDefaults,
    onKbSearch,
    onKbChange,
    onFileSearch,
    kbCategoryLabel,
  }
}
