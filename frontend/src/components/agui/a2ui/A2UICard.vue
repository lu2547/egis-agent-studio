<template>
  <div class="a2ui-card-wrap" v-html="html" @click="onClick"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { renderA2UI } from './a2ui'

/**
 * A2UI 卡片：将 A2UI 组件树 payload 渲染为 HTML，并把按钮交互冒泡为 action 事件。
 *
 * 按钮在 renderA2UI 中被注入 data-a2ui-action / data-a2ui-args 属性，
 * 这里统一委托捕获点击，发出 ('action', { type, args }) 给父级。
 *
 * 支持的 actionType：
 *   - sendMessage     默认行为，args 为消息文本，由父组件发送
 *   - openPPTist      打开内嵌 PPTist 抽屉，args 为 JSON 字符串（可选，透传给 PPTist）
 *
 * @prop  payload A2UI 组件 payload（含 components / rootComponentId / data）
 * @event action  ({ type: string; args: string }) 当点击带 action 的按钮时
 */
const props = defineProps<{ payload: any }>()

const emit = defineEmits<{ (e: 'action', data: { type: string; args: string }): void }>()

const html = computed(() => renderA2UI(props.payload))

function onClick(evt: MouseEvent) {
  const target = (evt.target as HTMLElement)?.closest?.('[data-a2ui-action]') as HTMLElement | null
  if (!target) return
  const actionType = target.getAttribute('data-a2ui-action') || ''
  const actionArgs = target.getAttribute('data-a2ui-args') || ''
  // 防止 <a> 跳页或 <button> 在 form 内 submit
  evt.preventDefault()
  evt.stopPropagation()
  if (!actionType) {
    console.warn('[A2UICard] action payload incomplete:', { actionType, actionArgs })
    return
  }
  emit('action', { type: actionType, args: actionArgs })
}
</script>

<style scoped>
.a2ui-card-wrap { margin: 8px 0; }
.a2ui-card-wrap :deep(.a2ui-rendered) { width: 100%; }
.a2ui-card-wrap :deep(button) { transition: all .15s ease; }
.a2ui-card-wrap :deep(button:hover) { filter: brightness(.95); transform: translateY(-1px); }
.a2ui-card-wrap :deep(a) { transition: all .15s ease; }
.a2ui-card-wrap :deep(a:hover) { filter: brightness(.95); }
</style>
