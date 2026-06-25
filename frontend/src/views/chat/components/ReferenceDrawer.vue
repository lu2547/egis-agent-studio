<template>
  <t-drawer
    v-model:visible="drawerVisible"
    size="480px"
    placement="right"
    :close-btn="true"
    :footer="false"
    :header="false"
  >
    <div class="ref-drawer">
      <div class="ref-drawer-header">
        <span v-if="drawerRef" class="ref-drawer-index">{{ drawerRef.index }}</span>
        <span class="ref-drawer-title">{{ drawerRef?.doc || '参考资料' }}</span>
      </div>
      <div v-if="drawerRef?.chunkId" class="ref-drawer-meta">
        片段 ID：{{ drawerRef.chunkId }}
        <span v-if="chunkIndex !== null"> · 序号：{{ chunkIndex }}</span>
      </div>
      <div class="ref-drawer-body">
        <div v-if="loading" class="ref-drawer-loading">加载中...</div>
        <div v-else-if="error" class="ref-drawer-error">{{ error }}</div>
        <div v-else-if="chunks.length" class="ref-material">
          <div
            ref="mergedRef"
            class="ref-material-merged markdown-body"
            v-html="mergedHtml"
          ></div>
        </div>
        <div v-else class="ref-drawer-empty">该文档暂无内容</div>
      </div>
    </div>
  </t-drawer>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { KnowledgeChunk } from '@/api'
import { renderChunkMarkdown, type MessageReference } from '../markdown'

const props = defineProps<{
  visible: boolean
  drawerRef: MessageReference | null
  loading: boolean
  error: string
  chunks: KnowledgeChunk[]
  chunkIndex: number | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const drawerVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})

const mergedRef = ref<HTMLElement | null>(null)

const mergedHtml = computed(() => {
  if (!props.chunks.length) return ''
  const md = props.chunks
    .map((chunk) => {
      const active = chunk.id === props.drawerRef?.chunkId ? '1' : '0'
      return `\n\n<!--CHUNK_MARKER:${chunk.id}:${chunk.chunk_index}:${active}-->\n\n${chunk.content || ''}`
    })
    .join('')
  return renderChunkMarkdown(md)
})

function processMergedMarkers() {
  const root = mergedRef.value
  if (!root) return

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT)
  const comments: Comment[] = []
  let n: Node | null
  while ((n = walker.nextNode())) comments.push(n as Comment)

  for (const comment of comments) {
    const match = comment.nodeValue?.match(/^CHUNK_MARKER:([^:]+):([^:]+):([01])$/)
    if (!match) continue
    const [, chunkId, idx, isActive] = match
    const label = document.createElement('div')
    label.className = 'chunk-marker' + (isActive === '1' ? ' active' : '')
    label.textContent = `#${idx}`
    label.dataset.chunkId = chunkId
    comment.parentNode?.insertBefore(label, comment)
    comment.remove()
  }

  const markers = Array.from(root.querySelectorAll(':scope > .chunk-marker')) as HTMLElement[]
  const activeIdx = markers.findIndex((el) => el.classList.contains('active'))
  if (activeIdx < 0) return

  const start = markers[activeIdx]
  const end = markers[activeIdx + 1] || null
  let cur: Element | null = start.nextElementSibling
  while (cur && cur !== end) {
    cur.classList.add('chunk-active-segment')
    cur = cur.nextElementSibling
  }
  start.scrollIntoView({ block: 'start', behavior: 'auto' })
}

watch(
  () => mergedHtml.value,
  async () => {
    await nextTick()
    processMergedMarkers()
  },
)
</script>

<style scoped>
.ref-drawer { padding: 4px 0; height: 100%; display: flex; flex-direction: column; }
.ref-drawer-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eee;
}
.ref-drawer-index {
  width: 28px; height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: #e8efff;
  color: #0052d9;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
}
.ref-drawer-title {
  font-size: 16px;
  font-weight: 600;
  color: #222;
  word-break: break-all;
}
.ref-drawer-meta {
  margin-top: 8px;
  font-size: 12px;
  color: #999;
  word-break: break-all;
}
.ref-drawer-body { margin-top: 14px; flex: 1; display: flex; flex-direction: column; min-height: 0; }
.ref-drawer-loading,
.ref-drawer-empty { color: #999; font-size: 13px; padding: 20px 0; text-align: center; }
.ref-drawer-error { color: #d54941; font-size: 13px; padding: 20px 0; text-align: center; }
.ref-material {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px 16px;
  border: 1px solid #eee;
  border-radius: 6px;
  background: #fff;
  color: #333;
  font-size: 13px;
  line-height: 1.75;
}
.ref-material-merged {
  word-break: break-word;
}
.ref-material-merged :deep(p) {
  margin: 6px 0;
}
.ref-material-merged :deep(ul),
.ref-material-merged :deep(ol) {
  margin: 6px 0;
  padding-left: 22px;
}
.ref-material-merged :deep(li) {
  margin: 2px 0;
}
.ref-material-merged :deep(table) {
  border-collapse: collapse;
  margin: 8px 0;
  width: 100%;
  font-size: 12px;
}
.ref-material-merged :deep(th),
.ref-material-merged :deep(td) {
  border: 1px solid #d9d9d9;
  padding: 4px 8px;
  text-align: left;
  vertical-align: top;
}
.ref-material-merged :deep(th) {
  background: #f5f7fa;
  font-weight: 600;
}
.ref-material-merged :deep(code) {
  background: #f2f3f5;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 12px;
}
.ref-material-merged :deep(pre) {
  background: #f6f8fa;
  padding: 8px 10px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 6px 0;
}
.ref-material-merged :deep(pre) code {
  background: transparent;
  padding: 0;
}
.ref-material-merged :deep(blockquote) {
  margin: 6px 0;
  padding: 4px 10px;
  border-left: 3px solid #d9d9d9;
  color: #666;
  background: #fafafa;
}
.ref-material-merged :deep(h1),
.ref-material-merged :deep(h2),
.ref-material-merged :deep(h3),
.ref-material-merged :deep(h4) {
  margin: 8px 0 4px;
  font-weight: 600;
  line-height: 1.4;
}
.ref-material-merged :deep(.chunk-marker) {
  display: inline-block;
  color: #0052d9;
  font-size: 12px;
  font-weight: 600;
  margin: 14px 0 6px;
  padding: 2px 8px;
  border-left: 3px solid transparent;
  border-radius: 2px;
}
.ref-material-merged :deep(.chunk-marker:first-child) {
  margin-top: 0;
}
.ref-material-merged :deep(.chunk-marker.active) {
  background: #f0f5ff;
  border-left-color: #0052d9;
  color: #0052d9;
}
.ref-material-merged :deep(.chunk-active-segment) {
  background: #f0f5ff;
  border-left: 3px solid #0052d9;
  padding: 4px 10px;
  margin-left: -13px;
  margin-right: -13px;
}
.ref-material-merged :deep(table.chunk-active-segment) {
  background: #f0f5ff;
  border-left: 3px solid #0052d9;
  padding: 0;
  margin-left: 0;
  margin-right: 0;
}
</style>
