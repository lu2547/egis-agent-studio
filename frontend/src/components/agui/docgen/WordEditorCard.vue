<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DocxEditor } from '@eigenpal/docx-editor-vue'
import '@eigenpal/docx-editor-vue/styles.css'
import type { DocxEditorRef } from '@eigenpal/docx-editor-vue'

const props = defineProps<{
  payload: any
}>()

const emit = defineEmits<{
  (e: 'action', data: { type: string; args: string }): void
}>()

const editorComp = computed(() => {
  const comps = props.payload?.components || []
  return comps.find((c: any) => c.component?.DocgenEditor)?.component?.DocgenEditor
})

const docxUrl = computed(() => editorComp.value?.docx_url || '')
const title = computed(() => editorComp.value?.title || 'Word 编辑器')
const fileName = computed(() => `${title.value}.docx`)
const documentBuffer = ref<ArrayBuffer | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const downloading = ref(false)
const editorRef = ref<DocxEditorRef | null>(null)

async function loadDocument() {
  if (!docxUrl.value) {
    errorMessage.value = '缺少 Word 文档地址'
    return
  }

  loading.value = true
  errorMessage.value = ''
  documentBuffer.value = null

  try {
    const resp = await fetch(docxUrl.value, { credentials: 'include' })
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

watch(docxUrl, loadDocument, { immediate: true })

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
    console.error('[WordEditorCard] download failed:', err)
    if (documentBuffer.value) downloadBlob(documentBuffer.value)
  } finally {
    downloading.value = false
  }
}

function onEditDone() {
  emit('action', {
    type: 'sendMessage',
    args: `我已完成文档编辑，文档: ${title.value}`,
  })
}

function isDocgenEditorPayload(payload: any): boolean {
  if (!payload?.components) return false
  return payload.components.some((c: any) => c.component?.DocgenEditor)
}

function isDocgenUploadPayload(payload: any): boolean {
  if (!payload?.components) return false
  return payload.components.some((c: any) => c.component?.FileUpload)
}

defineExpose({ isDocgenEditorPayload, isDocgenUploadPayload })
</script>

<template>
  <div class="docgen-editor-card">
    <div class="card-header">
      <strong>Word 编辑器 — {{ title }}</strong>
      <div class="header-actions">
        <button class="btn-download" type="button" @click="downloadDocx" :disabled="downloading || !documentBuffer">
          {{ downloading ? '下载中…' : '⬇ 下载文档' }}
        </button>
      </div>
    </div>

    <p class="card-desc">
      您可以在下方编辑器中查看和修改文档内容，完成后点击"编辑完成"。
    </p>

    <div class="editor-frame">
      <div v-if="loading" class="editor-state">编辑器加载中…</div>
      <div v-else-if="errorMessage" class="editor-error">{{ errorMessage }}</div>
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

    <div class="card-footer">
      <button class="btn-done" type="button" @click="onEditDone">
        ✓ 编辑完成
      </button>
    </div>
  </div>
</template>

<style scoped>
.docgen-editor-card {
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #e4e9f2;
  box-shadow: 0 8px 20px rgba(20, 34, 70, 0.06);
  overflow: hidden;
  padding: 16px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.card-header strong {
  color: #1e2432;
  font-size: 16px;
  font-weight: 900;
}

.btn-download,
.btn-done {
  height: 30px;
  padding: 0 14px;
  border: 1px solid #d4dae6;
  border-radius: 6px;
  background: #ffffff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-download {
  color: #0052d9;
}

.btn-download:hover {
  background: #f0f4ff;
  border-color: #0052d9;
}

.btn-download:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.card-desc {
  color: #666;
  font-size: 13px;
  margin: 4px 0 12px;
  line-height: 1.5;
}

.editor-frame {
  position: relative;
  height: 620px;
  border: 1px solid #e4e9f2;
  border-radius: 8px;
  overflow: hidden;
  background: #fafbfe;
}

.docx-editor {
  height: 100%;
  background: #fff;
}

.editor-state,
.editor-error {
  height: 100%;
  display: grid;
  place-items: center;
  color: #666;
  font-size: 14px;
  background: #fff;
}

.editor-error {
  color: #b42318;
  padding: 24px;
  text-align: center;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.btn-done {
  border-color: #0052d9;
  color: #ffffff;
  background: #0052d9;
}
</style>
