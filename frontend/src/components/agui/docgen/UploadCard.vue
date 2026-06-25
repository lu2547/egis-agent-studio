<script setup lang="ts">
import { ref, computed } from 'vue'

/**
 * DocGen 文件上传卡片
 *
 * 检测 A2UI payload 中的 FileUpload 组件，渲染原生文件选择 + 拖拽区域。
 * 上传完成后 emit sendMessage 回传文件路径。
 */
const props = defineProps<{
  payload: any
}>()

const emit = defineEmits<{
  (e: 'action', data: { type: string; args: string }): void
}>()

// 从 A2UI payload 中提取 FileUpload 组件属性
const fileUploadComp = computed(() => {
  const comps = props.payload?.components || []
  return comps.find((c: any) => c.component?.FileUpload)?.component?.FileUpload
})

const projectId = computed(() => fileUploadComp.value?.project_id || '')
const acceptedTypes = computed(() => fileUploadComp.value?.accepted_types?.join(',') || '*')
const placeholder = computed(() => fileUploadComp.value?.placeholder || '点击或拖拽文件到此处上传')
const maxSizeMB = computed(() => fileUploadComp.value?.max_size_mb || 50)
const title = computed(() => {
  const comps = props.payload?.components || []
  const titleComp = comps.find((c: any) => c.id === 'title-text')
  return titleComp?.component?.Text?.text?.literalString || '请上传文件'
})
const description = computed(() => {
  const comps = props.payload?.components || []
  const descComp = comps.find((c: any) => c.id === 'desc-text')
  return descComp?.component?.Text?.text?.literalString || ''
})

const isDragging = ref(false)
const selectedFile = ref<File | null>(null)
const uploading = ref(false)
const errorMsg = ref('')

const fileInput = ref<HTMLInputElement | null>(null)

function triggerFileInput() {
  fileInput.value?.click()
}

function onFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files?.length) {
    handleFile(target.files[0])
  }
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function onDragLeave() {
  isDragging.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  if (e.dataTransfer?.files?.length) {
    handleFile(e.dataTransfer.files[0])
  }
}

function handleFile(file: File) {
  errorMsg.value = ''
  const sizeMB = file.size / (1024 * 1024)
  if (sizeMB > maxSizeMB.value) {
    errorMsg.value = `文件大小 ${sizeMB.toFixed(1)}MB 超过限制 ${maxSizeMB.value}MB`
    return
  }
  selectedFile.value = file
  uploadFile(file)
}

async function uploadFile(file: File) {
  uploading.value = true
  errorMsg.value = ''

  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('project_id', projectId.value)

    const resp = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })

    if (!resp.ok) {
      throw new Error(`Upload failed: ${resp.statusText}`)
    }

    const data = await resp.json()
    const filePath = data.file_path || data.path || ''
    const fileName = file.name

    // 通过 sendMessage action 回传文件路径
    emit('action', {
      type: 'sendMessage',
      args: `我已上传文件: ${fileName}，路径: ${filePath}`,
    })
  } catch (err: any) {
    errorMsg.value = `上传失败: ${err.message || '未知错误'}`
  } finally {
    uploading.value = false
  }
}

function formatTypes(): string {
  const types = fileUploadComp.value?.accepted_types || []
  return types.length ? types.join(' ') : '.pdf .doc .docx .png .jpg'
}
</script>

<template>
  <div class="docgen-upload-card">
    <div class="card-header">
      <strong>{{ title }}</strong>
    </div>
    <p v-if="description" class="card-desc">{{ description }}</p>

    <div
      :class="['upload-zone', { dragging: isDragging, 'has-file': selectedFile, error: errorMsg }]"
      @click="triggerFileInput"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <input
        ref="fileInput"
        type="file"
        :accept="acceptedTypes"
        style="display: none"
        @change="onFileSelect"
      />

      <template v-if="uploading">
        <div class="upload-icon">⏳</div>
        <div class="upload-text">上传中…</div>
      </template>
      <template v-else-if="selectedFile">
        <div class="upload-icon">✅</div>
        <div class="upload-text">{{ selectedFile.name }}</div>
        <div class="upload-size">{{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB</div>
      </template>
      <template v-else>
        <div class="upload-icon">📄</div>
        <div class="upload-text">{{ placeholder }}</div>
        <div class="upload-hint">{{ formatTypes() }}</div>
      </template>
    </div>

    <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
  </div>
</template>

<style scoped>
.docgen-upload-card {
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #e4e9f2;
  box-shadow: 0 8px 20px rgba(20, 34, 70, 0.06);
  overflow: hidden;
  padding: 16px;
}

.card-header strong {
  color: #1e2432;
  font-size: 16px;
  font-weight: 900;
}

.card-desc {
  color: #666;
  font-size: 13px;
  margin: 4px 0 12px;
  line-height: 1.5;
}

.upload-zone {
  border: 2px dashed #d4dae6;
  border-radius: 8px;
  padding: 32px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #fafbfe;
}

.upload-zone:hover,
.upload-zone.dragging {
  border-color: #426cff;
  background: #f0f4ff;
}

.upload-zone.has-file {
  border-color: #40aa68;
  background: #eafaf0;
}

.upload-zone.error {
  border-color: #ff5c86;
  background: #fff0f4;
}

.upload-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.upload-text {
  color: #1e2432;
  font-size: 14px;
  font-weight: 700;
}

.upload-hint {
  color: #999;
  font-size: 11px;
  margin-top: 4px;
}

.upload-size {
  color: #7b8493;
  font-size: 12px;
  margin-top: 2px;
}

.error-msg {
  color: #ff5c86;
  font-size: 12px;
  margin-top: 8px;
}
</style>
