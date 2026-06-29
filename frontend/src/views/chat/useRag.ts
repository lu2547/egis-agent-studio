/**
 * RAG 资料范围选择器 composable
 *
 * UI 采用“知识库 -> 标签 -> 文件”的树形资料范围。发送给后端的
 * rag_state 只包含 rag_filter，扁平字段仅作为本地 UI 选择状态。
 */

import { computed, reactive, ref } from 'vue'
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

export type RagFilterFile = {
  id: string
  name: string
  type: 'file'
}

export type RagFilterTag = {
  tag_id: string
  tag_name: string
  files: RagFilterFile[]
}

export type RagFilterKb = {
  kb_id: string
  kb_name: string
  tags: RagFilterTag[]
  files?: RagFilterFile[]
}

export function useRag() {
  const scopeSelection = reactive({
    kbIds: [] as string[],
    tagIds: [] as string[],
    fileIds: [] as string[],
  })

  const kbOptions = ref<RAGKnowledgeBase[]>([])
  const tagOptions = ref<RAGTag[]>([])
  const fileOptions = ref<RAGFile[]>([])
  const activeKbId = ref('')
  const scopeSearchKeyword = ref('')
  const kbLoading = ref(false)
  const tagLoading = ref(false)
  const fileLoading = ref(false)
  const agentUsesRag = ref(false)

  let lastSentRagFingerprint: string | null = null

  const selectedKbs = computed(() => {
    const selected = new Set(scopeSelection.kbIds)
    return kbOptions.value.filter((kb) => selected.has(kb.id))
  })

  const activeKb = computed(() => {
    return (
      kbOptions.value.find((kb) => kb.id === activeKbId.value)
      || selectedKbs.value[0]
      || kbOptions.value[0]
      || null
    )
  })

  const activeTags = computed(() => {
    const kb = activeKb.value
    if (!kb) return []
    return tagOptions.value.filter((tag) => tag.knowledge_base_id === kb.id)
  })

  const activeFiles = computed(() => {
    const kb = activeKb.value
    if (!kb) return []
    const keyword = scopeSearchKeyword.value.trim().toLowerCase()
    const selectedTagIds = getSelectedTagIdsForKb(kb.id)
    return fileOptions.value.filter((file) => {
      if (file.knowledge_base_id !== kb.id) return false
      if (selectedTagIds.length > 0 && file.tag_id && !selectedTagIds.includes(file.tag_id)) return false
      if (selectedTagIds.length > 0 && !file.tag_id) return false
      if (!keyword) return true
      const tagName = tagOptions.value.find((tag) => tag.id === file.tag_id)?.name || ''
      return file.title.toLowerCase().includes(keyword)
        || file.file_name.toLowerCase().includes(keyword)
        || tagName.toLowerCase().includes(keyword)
    })
  })

  const selectedScopeBadges = computed(() => {
    const badges: Array<{ key: string; text: string; kind: 'kb' | 'tag' | 'file'; id: string }> = []
    for (const kb of selectedKbs.value) {
      const files = fileOptions.value.filter((file) => scopeSelection.fileIds.includes(file.id) && file.knowledge_base_id === kb.id)
      const tags = tagOptions.value.filter((tag) => scopeSelection.tagIds.includes(tag.id) && tag.knowledge_base_id === kb.id)
      if (files.length === 0 && tags.length === 0) {
        badges.push({ key: `kb:${kb.id}`, text: `${kb.name}(全部)`, kind: 'kb', id: kb.id })
        continue
      }
      const selectedTagIds = new Set(tags.map((tag) => tag.id))
      for (const tag of tags) {
        badges.push({ key: `tag:${tag.id}`, text: `${tag.name}(${kb.name})`, kind: 'tag', id: tag.id })
      }
      for (const file of files) {
        if (!file.tag_id || !selectedTagIds.has(file.tag_id)) {
          badges.push({ key: `file:${file.id}`, text: `${file.title || file.file_name}(${kb.name})`, kind: 'file', id: file.id })
        }
      }
    }
    return badges
  })

  function computeRagFingerprint(): string {
    return JSON.stringify(getRagPayload())
  }

  function getRagChanged(): { changed: boolean; fingerprint: string } {
    const h = computeRagFingerprint()
    return { changed: h !== lastSentRagFingerprint, fingerprint: h }
  }

  function markRagSynced(fingerprint: string) {
    lastSentRagFingerprint = fingerprint
  }

  function resetRagFingerprint() {
    lastSentRagFingerprint = null
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
      if (!activeKbId.value && kbOptions.value[0]) activeKbId.value = kbOptions.value[0].id
    } catch (err) {
      console.error('listKnowledgeBases failed:', err)
    } finally {
      kbLoading.value = false
    }
  }

  async function loadSelectedKbChildren() {
    const scopedKbIds = Array.from(new Set([...scopeSelection.kbIds, activeKbId.value].filter(Boolean)))
    if (scopedKbIds.length === 0) {
      tagOptions.value = []
      fileOptions.value = []
      scopeSelection.tagIds = []
      scopeSelection.fileIds = []
      return
    }

    tagLoading.value = true
    fileLoading.value = true
    try {
      const [tagsRes, filesRes] = await Promise.all([
        listTags({ kb_ids: scopedKbIds, limit: 1000 }),
        listFiles({ kb_ids: scopedKbIds, limit: 1000 }),
      ])
      tagOptions.value = tagsRes.data.items || []
      fileOptions.value = filesRes.data.items || []
      const validTags = new Set(tagOptions.value.map((tag) => tag.id))
      const validFiles = new Set(fileOptions.value.map((file) => file.id))
      scopeSelection.tagIds = scopeSelection.tagIds.filter((id) => validTags.has(id))
      scopeSelection.fileIds = scopeSelection.fileIds.filter((id) => validFiles.has(id))
    } catch (err) {
      console.error('loadSelectedKbChildren failed:', err)
    } finally {
      tagLoading.value = false
      fileLoading.value = false
    }
  }

  async function activateKb(kbId: string) {
    activeKbId.value = kbId
    scopeSearchKeyword.value = ''
    await loadSelectedKbChildren()
  }

  async function onKbSearch(keyword: string) {
    if (!keyword || !keyword.trim()) {
      await loadKbDefaults()
      return
    }
    kbLoading.value = true
    try {
      const res = await listKnowledgeBases({ names: [keyword.trim()], limit: 50 })
      const map = new Map<string, RAGKnowledgeBase>()
      for (const kb of kbOptions.value) {
        if (scopeSelection.kbIds.includes(kb.id)) map.set(kb.id, kb)
      }
      for (const kb of res.data.items || []) map.set(kb.id, kb)
      kbOptions.value = Array.from(map.values())
    } catch (err) {
      console.error('listKnowledgeBases search failed:', err)
    } finally {
      kbLoading.value = false
    }
  }

  async function toggleKb(kb: RAGKnowledgeBase) {
    if (scopeSelection.kbIds.includes(kb.id)) {
      scopeSelection.kbIds = scopeSelection.kbIds.filter((id) => id !== kb.id)
      scopeSelection.tagIds = scopeSelection.tagIds.filter((id) => tagOptions.value.find((tag) => tag.id === id)?.knowledge_base_id !== kb.id)
      scopeSelection.fileIds = scopeSelection.fileIds.filter((id) => fileOptions.value.find((file) => file.id === id)?.knowledge_base_id !== kb.id)
    } else {
      scopeSelection.kbIds = [...scopeSelection.kbIds, kb.id]
      activeKbId.value = kb.id
    }
    await loadSelectedKbChildren()
  }

  async function toggleWholeKb(kb: RAGKnowledgeBase) {
    const tagSet = new Set(tagOptions.value.filter((tag) => tag.knowledge_base_id === kb.id).map((tag) => tag.id))
    const fileSet = new Set(fileOptions.value.filter((file) => file.knowledge_base_id === kb.id).map((file) => file.id))
    if (isWholeKbSelected(kb.id)) {
      scopeSelection.kbIds = scopeSelection.kbIds.filter((id) => id !== kb.id)
    } else if (!scopeSelection.kbIds.includes(kb.id)) {
      scopeSelection.kbIds = [...scopeSelection.kbIds, kb.id]
    }
    scopeSelection.tagIds = scopeSelection.tagIds.filter((id) => !tagSet.has(id))
    scopeSelection.fileIds = scopeSelection.fileIds.filter((id) => !fileSet.has(id))
    activeKbId.value = kb.id
    await loadSelectedKbChildren()
  }

  function ensureKbSelected(kbId: string) {
    if (!scopeSelection.kbIds.includes(kbId)) {
      scopeSelection.kbIds = [...scopeSelection.kbIds, kbId]
      loadSelectedKbChildren()
    }
  }

  function toggleTag(tag: RAGTag) {
    ensureKbSelected(tag.knowledge_base_id)
    scopeSelection.tagIds = scopeSelection.tagIds.includes(tag.id)
      ? scopeSelection.tagIds.filter((id) => id !== tag.id)
      : [...scopeSelection.tagIds, tag.id]
  }

  function toggleFile(file: RAGFile) {
    ensureKbSelected(file.knowledge_base_id)
    scopeSelection.fileIds = scopeSelection.fileIds.includes(file.id)
      ? scopeSelection.fileIds.filter((id) => id !== file.id)
      : [...scopeSelection.fileIds, file.id]
  }

  function isKbSelected(kbId: string): boolean {
    return scopeSelection.kbIds.includes(kbId)
  }

  function isTagSelected(tagId: string): boolean {
    return scopeSelection.tagIds.includes(tagId)
  }

  function isFileSelected(fileId: string): boolean {
    return scopeSelection.fileIds.includes(fileId)
  }

  function getSelectedTagIdsForKb(kbId: string): string[] {
    const tagSet = new Set(tagOptions.value.filter((tag) => tag.knowledge_base_id === kbId).map((tag) => tag.id))
    return scopeSelection.tagIds.filter((id) => tagSet.has(id))
  }

  function tagsForKb(kbId: string): RAGTag[] {
    return tagOptions.value.filter((tag) => tag.knowledge_base_id === kbId)
  }

  function hasKbPreciseSelection(kbId: string): boolean {
    const tagSet = new Set(tagOptions.value.filter((tag) => tag.knowledge_base_id === kbId).map((tag) => tag.id))
    const fileSet = new Set(fileOptions.value.filter((file) => file.knowledge_base_id === kbId).map((file) => file.id))
    return scopeSelection.tagIds.some((id) => tagSet.has(id)) || scopeSelection.fileIds.some((id) => fileSet.has(id))
  }

  function isWholeKbSelected(kbId: string): boolean {
    return scopeSelection.kbIds.includes(kbId) && !hasKbPreciseSelection(kbId)
  }

  function clearScope() {
    scopeSelection.kbIds = []
    scopeSelection.tagIds = []
    scopeSelection.fileIds = []
  }

  function removeSelectedScopeBadge(badge: { kind: 'kb' | 'tag' | 'file'; id: string }) {
    if (badge.kind === 'kb') {
      const kb = kbOptions.value.find((item) => item.id === badge.id)
      if (kb) toggleKb(kb)
      return
    }
    if (badge.kind === 'tag') {
      scopeSelection.tagIds = scopeSelection.tagIds.filter((id) => id !== badge.id)
      return
    }
    scopeSelection.fileIds = scopeSelection.fileIds.filter((id) => id !== badge.id)
  }

  function getRagFilter(): RagFilterKb[] {
    return selectedKbs.value.map((kb) => {
      const kbTags = tagOptions.value.filter((tag) => tag.knowledge_base_id === kb.id)
      const kbFiles = fileOptions.value.filter((file) => file.knowledge_base_id === kb.id && scopeSelection.fileIds.includes(file.id))
      const tags: RagFilterTag[] = []

      for (const tag of kbTags) {
        const files = kbFiles
          .filter((file) => file.tag_id === tag.id)
          .map((file) => ({
            id: file.id,
            name: file.title || file.file_name,
            type: 'file' as const,
          }))
        const selectedWholeTag = scopeSelection.tagIds.includes(tag.id)
        if (selectedWholeTag || files.length > 0) {
          tags.push({
            tag_id: tag.id,
            tag_name: tag.name,
            files: selectedWholeTag ? [] : files,
          })
        }
      }

      const directFiles = kbFiles
        .filter((file) => !file.tag_id)
        .map((file) => ({
          id: file.id,
          name: file.title || file.file_name,
          type: 'file' as const,
        }))

      return {
        kb_id: kb.id,
        kb_name: kb.name,
        tags,
        ...(directFiles.length ? { files: directFiles } : {}),
      }
    })
  }

  function getRagPayload() {
    return {
      rag_filter: getRagFilter(),
    }
  }

  function hasRagScope(): boolean {
    return scopeSelection.kbIds.length > 0
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
    scopeSelection,
    kbOptions,
    tagOptions,
    fileOptions,
    activeKbId,
    scopeSearchKeyword,
    activeKb,
    activeTags,
    activeFiles,
    selectedKbs,
    selectedScopeBadges,
    kbLoading,
    tagLoading,
    fileLoading,
    agentUsesRag,
    getRagChanged,
    markRagSynced,
    resetRagFingerprint,
    detectAgentRagDeps,
    loadKbDefaults,
    loadSelectedKbChildren,
    activateKb,
    onKbSearch,
    toggleKb,
    toggleWholeKb,
    toggleTag,
    toggleFile,
    isKbSelected,
    isTagSelected,
    isFileSelected,
    getSelectedTagIdsForKb,
    tagsForKb,
    isWholeKbSelected,
    clearScope,
    removeSelectedScopeBadge,
    getRagPayload,
    hasRagScope,
    kbCategoryLabel,
  }
}
