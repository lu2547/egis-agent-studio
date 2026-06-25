<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DocxEditor } from '@eigenpal/docx-editor-vue'
import '@eigenpal/docx-editor-vue/styles.css'
import type { DocxEditorRef } from '@eigenpal/docx-editor-vue'

const props = defineProps<{
  visible: boolean
  docxUrl: string
  title?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'action', data: { type: string; args: string }): void
}>()

const localVisible = ref<boolean>(!!props.visible)
const loading = ref(false)
const errorMessage = ref('')
const documentBuffer = ref<ArrayBuffer | null>(null)
const downloading = ref(false)
const editorRef = ref<DocxEditorRef | null>(null)

watch(
  () => props.visible,
  (v) => {
    localVisible.value = v
    if (v) loadDocument()
  },
  { immediate: true },
)

watch(localVisible, (v) => {
  if (!v) emit('update:visible', false)
})

watch(() => props.docxUrl, () => {
  if (localVisible.value) loadDocument()
})

const drawerTitle = computed(() => props.title || '文档查看')
const fileName = computed(() => `${drawerTitle.value}.docx`)

async function loadDocument() {
  if (!props.docxUrl) {
    errorMessage.value = '缺少 Word 文档地址'
    return
  }

  loading.value = true
  errorMessage.value = ''
  documentBuffer.value = null

  try {
    const resp = await fetch(props.docxUrl, { credentials: 'include' })
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '')
      throw new Error(detail || resp.statusText)
    }
    documentBuffer.value = await resp.arrayBuffer()
  } catch (err: any) {
    errorMessage.value = `Word 文档加载失败：${err?.message || '未知错误'}`
  } finally {
    loading.value = false
  }
}

function downloadBlob(buffer: ArrayBuffer) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.value
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function downloadDocx() {
  downloading.value = true
  try {
    const saved = await editorRef.value?.save()
    if (saved) {
      downloadBlob(saved)
      return
    }
    if (documentBuffer.value) downloadBlob(documentBuffer.value)
  } catch (err) {
    console.error('[DocxEditorDrawer] download failed:', err)
    if (documentBuffer.value) downloadBlob(documentBuffer.value)
  } finally {
    downloading.value = false
  }
}

function onClose() {
  localVisible.value = false
}

function onConfirmDone() {
  localVisible.value = false
  emit('action', {
    type: 'sendMessage',
    args: `我已查看并确认文档：${drawerTitle.value}，请继续完成交付。`,
  })
}
</script>

<template>
  <t-drawer
    v-model:visible="localVisible"
    size="85%"
    placement="right"
    :close-btn="true"
    :footer="false"
    :header="drawerTitle"
    class="docx-editor-drawer"
    @close="onClose"
  >
    <div class="docx-drawer-body">
      <div v-if="loading" class="docx-state">
        <t-loading size="small" /> 正在加载 Word 文档…
      </div>
      <div v-else-if="errorMessage" class="docx-error">
        {{ errorMessage }}
      </div>
      <DocxEditor
        v-else-if="documentBuffer"
        ref="editorRef"
        class="docx-editor"
        :document-buffer="documentBuffer"
        :document-name="fileName"
        mode="editing"
        author="Egis"
        :show-outline="true"
        :show-outline-button="true"
      />
    </div>

    <div class="docx-drawer-footer">
      <t-button
        theme="default"
        @click="downloadDocx"
        :disabled="downloading || (!documentBuffer && !loading)"
      >
        <t-icon name="download" />
        {{ downloading ? '下载中…' : '下载文档' }}
      </t-button>
      <t-button theme="primary" @click="onConfirmDone">
        <t-icon name="check" /> 确认完成
      </t-button>
    </div>
  </t-drawer>
</template>

<style scoped>
.docx-drawer-body {
  height: calc(100% - 64px);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.docx-editor {
  flex: 1;
  min-height: 0;
  border: 1px solid #e7e7e7;
  border-radius: 6px;
  background: #fff;
  overflow: hidden;
}

.docx-state,
.docx-error {
  flex: 1;
  min-height: 0;
  border: 1px solid #e7e7e7;
  border-radius: 6px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #666;
  font-size: 13px;
}

.docx-error {
  color: #b42318;
  padding: 24px;
  text-align: center;
}

.docx-drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 0 0 0;
  border-top: 1px solid #eee;
}
</style>

<style>
.docx-editor-drawer .t-drawer__body {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}
</style>
