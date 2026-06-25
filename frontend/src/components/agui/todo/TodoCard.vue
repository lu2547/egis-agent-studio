<template>
  <div v-if="isTodoCard(card)" class="todo-card" :class="`todo-status-${todoStatus(card)}`">
    <div class="todo-header">
      <span class="todo-icon">✧</span>
      <span class="todo-title">{{ todoTitle(card) }}</span>
      <span class="todo-summary">{{ todoSummary(card) }}</span>
    </div>
    <ul v-if="steps.length" class="todo-steps">
      <li v-for="step in steps" :key="step.id" :class="`step-${step.status}`">
        <span class="step-marker">
          <t-icon v-if="step.status === 'completed'" name="check-circle" size="14px" />
          <t-icon v-else-if="step.status === 'in_progress'" name="loading" size="14px" />
          <t-icon v-else-if="step.status === 'blocked'" name="time" size="14px" />
          <span v-else class="step-dot"></span>
        </span>
        <span class="step-text">{{ step.text }}</span>
      </li>
    </ul>
    <!-- 推理文本：todo 卡片内部底部 -->
    <ThinkingCard :text="reasoning" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ThinkingCard from '../thinking/ThinkingCard.vue'
import { isTodoCard, todoTitle, todoSummary, todoStatus, todoSteps } from './todoHelpers'

/**
 * todo_write 计划卡片：待办步骤列表 + 底部推理文本槽。
 * @prop card      msg.todoCard（frontend_digest payload）
 * @prop reasoning msg.reasoning（推理文本，可选，渲染在卡片底部）
 */
const props = defineProps<{ card: any; reasoning?: string }>()

const steps = computed(() => todoSteps(props.card))
</script>

<style scoped>
.todo-card { border: 1px solid #e7e7e7; border-radius: 10px; background: #fafbfc; padding: 10px 14px; margin-bottom: 8px; transition: border-color .2s; }
.todo-card.todo-status-loading { border-color: #d4e3fc; }
.todo-card.todo-status-success { border-color: #c5e8d5; }
.todo-card.todo-status-warning { border-color: #f5d7a8; }
.todo-header { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #333; padding-bottom: 6px; border-bottom: 1px dashed #eee; margin-bottom: 8px; }
.todo-icon { color: #0052d9; font-size: 14px; }
.todo-title { font-weight: 500; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.todo-summary { color: #0052d9; font-weight: 600; font-size: 12px; flex-shrink: 0; }
.todo-status-success .todo-summary { color: #00a870; }
.todo-steps { list-style: none; padding: 0; margin: 0; }
.todo-steps li { display: flex; align-items: flex-start; gap: 8px; padding: 4px 0; font-size: 13px; line-height: 1.5; color: #555; }
.todo-steps li.step-completed { color: #888; }
.todo-steps li.step-in_progress { color: #0052d9; font-weight: 500; }
.todo-steps li.step-blocked { color: #e37318; }
.todo-steps li.step-pending { color: #999; }
.step-marker { width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
.step-marker :deep(.t-icon) { color: inherit; }
.step-completed .step-marker :deep(.t-icon) { color: #00a870; }
.step-in_progress .step-marker :deep(.t-icon) { color: #0052d9; animation: spin 1s linear infinite; }
.step-blocked .step-marker :deep(.t-icon) { color: #e37318; }
.step-dot { width: 6px; height: 6px; border-radius: 50%; background: #ccc; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
