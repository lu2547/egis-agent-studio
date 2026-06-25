<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  title?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'action', data: { type: string; args: string }): void
}>()

const localVisible = ref<boolean>(!!props.visible)
const drawerTitle = computed(() => props.title || '投资报告')

watch(
  () => props.visible,
  (v) => {
    localVisible.value = v
  },
  { immediate: true },
)

watch(localVisible, (v) => {
  if (!v) emit('update:visible', false)
})

function onClose() {
  localVisible.value = false
}

function onConfirmDone() {
  localVisible.value = false
  emit('action', {
    type: 'sendMessage',
    args: `我已查看投资报告模板：${drawerTitle.value}，请继续。`,
  })
}
</script>

<template>
  <t-drawer
    v-model:visible="localVisible"
    size="72%"
    placement="right"
    :close-btn="true"
    :footer="false"
    :header="drawerTitle"
    class="investment-report-drawer"
    @close="onClose"
  >
    <div class="investment-report-body">
      <div class="placeholder-panel">
        <div class="placeholder-title">投资报告模板</div>
        <div class="placeholder-meta">预留中</div>
      </div>
    </div>

    <div class="investment-report-footer">
      <t-button theme="primary" @click="onConfirmDone">
        <t-icon name="check" /> 确认
      </t-button>
    </div>
  </t-drawer>
</template>

<style scoped>
.investment-report-body {
  height: calc(100% - 56px);
  min-height: 0;
  background: #f7f8fa;
  border: 1px solid #e7e7e7;
  border-radius: 6px;
  padding: 16px;
}

.placeholder-panel {
  height: 100%;
  min-height: 320px;
  background: #fff;
  border: 1px dashed #c9d2e3;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.placeholder-title {
  color: #1f2937;
  font-size: 18px;
  font-weight: 700;
}

.placeholder-meta {
  color: #8a94a6;
  font-size: 13px;
}

.investment-report-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 0 0;
  border-top: 1px solid #eee;
}
</style>

<style>
.investment-report-drawer .t-drawer__body {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}
</style>
