<script setup lang="ts">
import { computed } from 'vue'

/**
 * DocGen 标化材料选择卡片
 *
 * 渲染 A2UI payload 中的标化材料选择卡片，支持多个材料选项。
 * 每个选项从 payload 组件树中动态提取（pension-item、tender-item 等）。
 */
const props = defineProps<{
  payload: any
}>()

const emit = defineEmits<{
  (e: 'action', data: { type: string; args: string }): void
}>()

// 从 A2UI payload 提取标题
const title = computed(() => {
  const comps = props.payload?.components || []
  const titleComp = comps.find((c: any) => c.id === 'title-text')
  return titleComp?.component?.Text?.text?.literalString || '请选择标化材料类型'
})

const description = computed(() => {
  const comps = props.payload?.components || []
  const descComp = comps.find((c: any) => c.id === 'desc-text')
  return descComp?.component?.Text?.text?.literalString || '选择需要制作的标化材料'
})

// 提取所有材料选项
const materialOptions = computed(() => {
  const comps = props.payload?.components || []
  const options: Array<{
    id: string
    title: string
    tag: string
    desc: string
    action: { type: string; args: string } | null
  }> = []

  // 平安养老险优势介绍
  const pensionBtn = comps.find((c: any) => c.id === 'pension-btn')?.component?.Button
  const pensionTitle = comps.find((c: any) => c.id === 'pension-title')?.component?.Text?.text?.literalString
  const pensionDesc = comps.find((c: any) => c.id === 'pension-desc')?.component?.Text?.text?.literalString
  const pensionTag = comps.find((c: any) => c.id === 'pension-tag')?.component?.Tag?.text?.literalString
  if (pensionBtn) {
    options.push({
      id: 'pension',
      title: pensionTitle || '平安养老险优势介绍 [word]',
      tag: pensionTag || '首期',
      desc: pensionDesc || '基于知识库自动生成平安养老险优势介绍材料',
      action: {
        type: pensionBtn.action?.type || 'sendMessage',
        args: pensionBtn.action?.message || '我选择平安养老险优势介绍 [word] 标化制作',
      },
    })
  }

  // 标书
  const tenderBtn = comps.find((c: any) => c.id === 'tender-btn')?.component?.Button
  const tenderTitle = comps.find((c: any) => c.id === 'tender-title')?.component?.Text?.text?.literalString
  const tenderDesc = comps.find((c: any) => c.id === 'tender-desc')?.component?.Text?.text?.literalString
  const tenderTag = comps.find((c: any) => c.id === 'tender-tag')?.component?.Tag?.text?.literalString
  if (tenderBtn) {
    options.push({
      id: 'tender',
      title: tenderTitle || '标书 [word]',
      tag: tenderTag || '首期',
      desc: tenderDesc || '上传招标材料 → AI 解析 → 基于知识库生成投标材料初稿',
      action: {
        type: tenderBtn.action?.type || 'sendMessage',
        args: tenderBtn.action?.message || '我选择标书 [word] 标化制作',
      },
    })
  }

  return options
})

function selectMaterial(option: { action: { type: string; args: string } | null }) {
  if (option.action) {
    emit('action', {
      type: option.action.type,
      args: option.action.args,
    })
  }
}

/** 检测 payload 是否为标化材料选择卡片 */
function isStandardDocPayload(payload: any): boolean {
  if (!payload?.components) return false
  return payload.components.some((c: any) => c.id === 'tender-btn' || c.id === 'pension-btn')
}

defineExpose({ isStandardDocPayload })
</script>

<template>
  <div class="docgen-standard-card">
    <div class="card-header">
      <strong>{{ title }}</strong>
    </div>
    <p class="card-desc">{{ description }}</p>

    <div class="doc-options">
      <div
        v-for="option in materialOptions"
        :key="option.id"
        class="doc-option"
        @click="selectMaterial(option)"
      >
        <div class="option-header">
          <span class="option-icon">📄</span>
          <span class="option-title">{{ option.title }}</span>
          <span class="option-tag">{{ option.tag }}</span>
        </div>
        <p class="option-desc">{{ option.desc }}</p>
        <button class="option-btn" type="button">
          选择制作
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.docgen-standard-card {
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

.doc-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.doc-option {
  border: 1px solid #e4e9f2;
  border-radius: 8px;
  padding: 14px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #fafbfe;
}

.doc-option:hover {
  border-color: #426cff;
  background: #f0f4ff;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(66, 108, 255, 0.1);
}

.option-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.option-icon {
  font-size: 20px;
}

.option-title {
  color: #1e2432;
  font-size: 15px;
  font-weight: 800;
}

.option-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
  background: #fff4e0;
  color: #d4760a;
}

.option-desc {
  color: #666;
  font-size: 13px;
  margin: 6px 0 10px;
  line-height: 1.5;
}

.option-btn {
  width: 100%;
  height: 36px;
  border: 0;
  border-radius: 6px;
  color: #ffffff;
  background: linear-gradient(135deg, #3f7cff, #7158ff);
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s ease;
}

.option-btn:hover {
  filter: brightness(1.05);
}
</style>
