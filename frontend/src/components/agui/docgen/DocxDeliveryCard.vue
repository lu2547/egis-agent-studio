<script setup lang="ts">
const props = defineProps<{
  payload: {
    docx_url?: string
    title?: string
    confirmed?: boolean
  }
}>()

const emit = defineEmits<{
  (e: 'action', data: { type: string; args: string }): void
}>()

function openDrawer() {
  emit('action', {
    type: 'openDocxDrawer',
    args: JSON.stringify({
      docx_url: props.payload.docx_url || '',
      title: props.payload.title || '文档查看',
      confirmed: true,
    }),
  })
}

</script>

<template>
  <div class="docx-delivery-card">
    <div class="delivery-main">
      <div class="delivery-title">✅ 交付完成</div>
      <div class="delivery-text">
        您的《{{ payload.title || '文档' }}》已成功生成并交付。
      </div>
      <div class="delivery-subtext">
        文档已保存在项目 artifacts 中，可随时打开查看或继续编辑。
      </div>
    </div>
    <div class="delivery-actions">
      <button class="action-btn secondary" type="button" :disabled="!payload.docx_url" @click="openDrawer">
        打开文档
      </button>
    </div>
  </div>
</template>

<style scoped>
.docx-delivery-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px 24px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.delivery-main {
  min-width: 0;
}

.delivery-title {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 12px;
}

.delivery-text {
  font-size: 15px;
  color: #111827;
  line-height: 1.7;
}

.delivery-subtext {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.7;
  margin-top: 4px;
}

.delivery-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.action-btn {
  height: 36px;
  padding: 0 14px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: #fff;
}

.action-btn.secondary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

.action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (max-width: 720px) {
  .docx-delivery-card {
    align-items: stretch;
    flex-direction: column;
  }

  .delivery-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
