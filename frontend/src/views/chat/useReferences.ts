import { ref } from 'vue'
import { getKnowledgeChunks, type KnowledgeChunk } from '@/api'
import {
  loadChunkDetail,
  renderMessageContent,
  type MessageReference,
  type RenderedMessage,
} from './markdown'

export function useReferences() {
  const renderCache = new WeakMap<object, { content: string; rendered: RenderedMessage }>()

  function renderedAnswer(msg: any): RenderedMessage {
    if (!msg) return { html: '', references: [] }
    const content = msg.content || ''
    const cached = renderCache.get(msg)
    if (cached && cached.content === content) return cached.rendered
    const rendered = renderMessageContent(content)
    renderCache.set(msg, { content, rendered })
    return rendered
  }

  const drawerVisible = ref(false)
  const drawerRef = ref<MessageReference | null>(null)
  const drawerLoading = ref(false)
  const drawerChunks = ref<KnowledgeChunk[]>([])
  const drawerChunkIndex = ref<number | null>(null)
  const drawerError = ref('')

  async function openRefDrawer(r: MessageReference) {
    drawerRef.value = r
    drawerVisible.value = true
    drawerError.value = ''
    drawerChunks.value = []
    drawerChunkIndex.value = null
    drawerLoading.value = true

    const entry = await loadChunkDetail(r.chunkId)
    drawerChunkIndex.value = entry.chunkIndex ?? null
    if (entry.error) {
      drawerLoading.value = false
      drawerError.value = entry.error
      return
    }
    if (!entry.knowledgeId) {
      drawerLoading.value = false
      drawerError.value = '无法获取文档 ID'
      return
    }

    try {
      const res = await getKnowledgeChunks(entry.knowledgeId)
      drawerChunks.value = res.data?.items || []
      if (!drawerChunks.value.length) {
        drawerError.value = '该文档暂无可展示片段'
      }
    } catch (e: any) {
      drawerError.value = e?.response?.status === 404 ? '文档片段未找到' : '完整材料加载失败'
    } finally {
      drawerLoading.value = false
    }
  }

  function onAnswerClick(e: Event) {
    const target = (e.target as HTMLElement)?.closest?.('.ref-badge') as HTMLElement | null
    if (!target) return
    const chunkId = target.getAttribute('data-chunk-id') || ''
    const doc = target.getAttribute('data-doc') || ''
    const idxStr = target.getAttribute('data-ref-index') || ''
    if (!chunkId) return
    openRefDrawer({ index: Number(idxStr) || 0, doc, chunkId })
  }

  return {
    renderedAnswer,
    onAnswerClick,
    drawerVisible,
    drawerRef,
    drawerLoading,
    drawerChunks,
    drawerChunkIndex,
    drawerError,
  }
}
