<script setup lang="ts">
import { ref, computed } from 'vue'

/**
 * DocGen 入口卡片 — Step1(选方式) → Step2(选方案)
 */

interface ModeOption {
  id: string
  title: string
  tag: string
  desc: string
  features: string
}

interface PlanOption {
  id: string
  title: string
  tag: string
  desc: string
  display: string
  event: Record<string, any>
}

const emit = defineEmits<{
  (e: 'action', data: { type: string; args: string }): void
}>()

const props = defineProps<{
  payload?: {
    initial_mode?: string
  }
}>()

const initialMode = props.payload?.initial_mode === 'standard' || props.payload?.initial_mode === 'ai'
  ? props.payload.initial_mode
  : null

const currentStep = ref(initialMode ? 2 : 1)
const selectedMode = ref<string | null>(initialMode)
const selectedPlan = ref<string | null>(null)
const searchQuery = ref('')
const isConfirmed = ref(false)

const modes: ModeOption[] = [
  {
    id: 'standard',
    title: '标化材料制作',
    tag: '快速',
    desc: '基于固定模板 + AI 智能填充，适合有标准格式的报表类材料',
    features: '固定格式模板 · AI 智能填充数据 · 快速生成报表',
  },
  {
    id: 'ai',
    title: 'AI 制作',
    tag: '灵活',
    desc: 'AI 全程参与：智能列大纲 → 可编辑调整 → AI 生成 PPT/Word',
    features: 'AI 智能生成大纲 · 可编辑可调序 · PPT / Word 多格式输出',
  },
]

const planMap: Record<string, PlanOption[]> = {
  standard: [
    {
      id: 'tender',
      title: '标书',
      tag: 'word',
      desc: '上传招标材料 → AI 解析 → 生成投标材料',
      display: '我选择标书',
      event: { flow: 'docgen_entry_flow', action: 'select_template', template_id: 'tender' },
    },
    {
      id: 'pension',
      title: '平安养老险优势介绍',
      tag: 'word',
      desc: '基于知识库自动生成优势介绍材料',
      display: '我选择平安养老险优势介绍',
      event: { flow: 'docgen_entry_flow', action: 'select_template', template_id: 'pension_intro' },
    },
    {
      id: 'investment',
      title: '投资报告',
      tag: 'word',
      desc: '投资报告标化模板',
      display: '我选择投资报告',
      event: { flow: 'docgen_entry_flow', action: 'select_template', template_id: 'investment_report' },
    },
  ],
  ai: [
    {
      id: 'word',
      title: 'Word 文档',
      tag: 'AI',
      desc: 'AI 生成大纲 → 编辑 → 生成 Word',
      display: '我选择 AI 制作 Word 文档',
      event: { flow: 'docgen_entry_flow', action: 'select_template', template_id: 'ai_word' },
    },
    {
      id: 'ppt',
      title: 'PPT 演示文稿',
      tag: 'AI',
      desc: 'AI 生成大纲 → 编辑 → 生成 PPT',
      display: '我选择 AI 制作 PPT 演示文稿',
      event: { flow: 'docgen_entry_flow', action: 'select_template', template_id: 'ai_ppt' },
    },
  ],
}

const currentPlans = computed(() => {
  if (!selectedMode.value) return []
  const plans = planMap[selectedMode.value] || []
  if (!searchQuery.value) return plans
  const q = searchQuery.value.toLowerCase()
  return plans.filter(p =>
    p.title.toLowerCase().includes(q) ||
    p.desc.toLowerCase().includes(q) ||
    p.tag.toLowerCase().includes(q),
  )
})

const selectedPlanOption = computed(() => {
  if (!selectedPlan.value) return null
  return currentPlans.value.find(p => p.id === selectedPlan.value) || null
})

function selectMode(modeId: string) {
  selectedMode.value = modeId
  selectedPlan.value = null
  searchQuery.value = ''
  currentStep.value = 2
}

function backToStep1() {
  currentStep.value = 1
  selectedMode.value = null
  selectedPlan.value = null
}

function togglePlan(planId: string) {
  if (isConfirmed.value) return
  selectedPlan.value = selectedPlan.value === planId ? null : planId
}

function confirmSelection() {
  if (!selectedPlanOption.value || isConfirmed.value) return
  isConfirmed.value = true
  emit('action', {
    type: 'docgenEvent',
    args: JSON.stringify({
      event: selectedPlanOption.value.event,
      display: selectedPlanOption.value.display,
    }),
  })
}
</script>

<template>
  <div class="entry-card">
    <!-- Step 指示器 -->
    <div class="step-indicator">
      <div :class="['step-dot', { active: currentStep >= 1, done: currentStep > 1 }]">
        <span v-if="currentStep > 1">✓</span><span v-else>1</span>
      </div>
      <span :class="['step-label', { active: currentStep >= 1 }]">选择制作方式</span>
      <div :class="['step-line', { active: currentStep >= 2 }]"></div>
      <div :class="['step-dot', { active: currentStep >= 2 }]">
        <span>2</span>
      </div>
      <span :class="['step-label', { active: currentStep >= 2 }]">选择具体方案</span>
    </div>

    <!-- Step 1: 选择制作方式 -->
    <div v-if="currentStep === 1" class="step-content">
      <div class="mode-grid">
        <div
          v-for="mode in modes"
          :key="mode.id"
          class="mode-card"
          @click="selectMode(mode.id)"
        >
          <div class="mode-header">
            <span class="mode-title">{{ mode.title }}</span>
            <span class="tag">{{ mode.tag }}</span>
          </div>
          <p class="mode-desc">{{ mode.desc }}</p>
          <p class="mode-features">{{ mode.features }}</p>
        </div>
      </div>
    </div>

    <!-- Step 2: 选择具体方案 -->
    <div v-else class="step-content">
      <div class="step2-toolbar">
        <input
          v-if="!isConfirmed"
          v-model="searchQuery"
          class="search-input"
          type="text"
          placeholder="搜索模板..."
        />
        <button v-if="!isConfirmed" class="ghost-btn" type="button" @click="backToStep1">返回重选</button>
        <button
          v-if="!isConfirmed"
          class="confirm-btn"
          :class="{ disabled: !selectedPlan }"
          :disabled="!selectedPlan"
          type="button"
          @click="confirmSelection"
        >
          确认选择
        </button>
        <span v-else class="confirmed-badge">✓ 已确认</span>
      </div>

      <div :class="['plan-grid', { locked: isConfirmed }]">
        <div
          v-for="plan in currentPlans"
          :key="plan.id"
          :class="['plan-card', { selected: selectedPlan === plan.id }]"
          @click="togglePlan(plan.id)"
        >
          <div class="plan-card-top">
            <span class="plan-title">{{ plan.title }}</span>
            <span class="tag tag-sm">{{ plan.tag }}</span>
          </div>
          <p class="plan-desc">{{ plan.desc }}</p>
          <div v-if="selectedPlan === plan.id" class="plan-check">✓</div>
        </div>
      </div>

      <div v-if="!isConfirmed && currentPlans.length === 0" class="plan-empty">
        没有匹配的模板
      </div>
    </div>
  </div>
</template>

<style scoped>
.entry-card {
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #e4e9f2;
  box-shadow: 0 8px 20px rgba(20, 34, 70, 0.06);
  overflow: hidden;
  padding: 16px;
}

/* ── Step 指示器 ── */
.step-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px 16px;
}
.step-dot {
  width: 24px; height: 24px;
  border-radius: 50%;
  background: #e4e9f2; color: #999;
  font-size: 12px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.25s ease;
}
.step-dot.active { background: #426cff; color: #fff; }
.step-dot.done { background: #40aa68; color: #fff; }
.step-label { font-size: 12px; font-weight: 700; color: #999; }
.step-label.active { color: #1e2432; }
.step-line {
  flex: 0 0 32px; height: 2px;
  background: #e4e9f2; border-radius: 1px;
  transition: background 0.25s ease;
}
.step-line.active { background: #426cff; }

/* ── 通用标签 ── */
.tag {
  display: inline-block;
  padding: 2px 8px; border-radius: 10px;
  font-size: 11px; font-weight: 700;
  color: #426cff; background: #eef3ff;
}
.tag-sm { font-size: 10px; padding: 1px 6px; border-radius: 8px; }

/* ── Step 1: 制作方式 ── */
.mode-grid { display: flex; gap: 12px; }
.mode-card {
  flex: 1;
  border: 1px solid #e4e9f2; border-radius: 8px;
  padding: 14px 16px; cursor: pointer;
  transition: all 0.2s ease; background: #fafbfe;
}
.mode-card:hover {
  border-color: #426cff; background: #f0f4ff;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(66, 108, 255, 0.1);
}
.mode-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.mode-title { font-size: 15px; font-weight: 900; color: #1e2432; }
.mode-desc { color: #666; font-size: 13px; line-height: 1.5; margin: 0 0 6px; }
.mode-features { color: #999; font-size: 12px; margin: 0; }

/* ── Step 2: 工具栏 ── */
.step2-toolbar {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 12px;
}
.search-input {
  flex: 1; height: 32px;
  border: 1px solid #d4dae6; border-radius: 6px;
  padding: 0 10px; font-size: 13px;
  color: #1e2432; background: #fafbfe;
  outline: none; transition: border-color 0.18s;
}
.search-input:focus { border-color: #426cff; background: #fff; }
.ghost-btn {
  height: 32px; padding: 0 12px;
  border: 1px solid #d4dae6; border-radius: 6px;
  color: #666; background: #fff;
  font-size: 13px; font-weight: 700;
  cursor: pointer; white-space: nowrap;
  transition: all 0.18s ease;
}
.ghost-btn:hover { border-color: #426cff; color: #426cff; }
.confirm-btn {
  height: 32px; padding: 0 16px;
  border: 0; border-radius: 6px;
  color: #fff; background: #426cff;
  font-size: 13px; font-weight: 800;
  cursor: pointer; white-space: nowrap;
  transition: all 0.2s ease;
}
.confirm-btn:hover:not(.disabled) { filter: brightness(1.08); }
.confirm-btn.disabled { opacity: 0.35; cursor: not-allowed; }
.confirmed-badge {
  height: 32px; padding: 0 14px;
  border-radius: 6px;
  color: #40aa68; background: #eafaf0;
  font-size: 13px; font-weight: 800;
  display: inline-flex; align-items: center;
  white-space: nowrap;
}

/* ── Step 2: 模板网格 ── */
.plan-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.plan-card {
  position: relative;
  border: 1px solid #e4e9f2; border-radius: 8px;
  padding: 10px 12px; cursor: pointer;
  transition: all 0.18s ease; background: #fafbfe;
}
.plan-card:hover { border-color: #a0b4ff; background: #f5f8ff; }
.plan-card.selected {
  border-color: #426cff; background: #eef3ff;
  box-shadow: 0 0 0 2px rgba(66, 108, 255, 0.15);
}
.plan-card-top { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.plan-title { font-size: 14px; font-weight: 800; color: #1e2432; }
.plan-desc { color: #888; font-size: 12px; line-height: 1.4; margin: 0; }
.plan-check {
  position: absolute; top: 6px; right: 8px;
  width: 20px; height: 20px; border-radius: 50%;
  background: #426cff; color: #fff;
  font-size: 11px; font-weight: 900;
  display: flex; align-items: center; justify-content: center;
}
.plan-empty {
  text-align: center; color: #999; font-size: 13px;
  padding: 24px 0;
}

/* ── 确认后锁定 ── */
.plan-grid.locked { pointer-events: none; }
.plan-grid.locked .plan-card { opacity: 0.5; }
.plan-grid.locked .plan-card.selected { opacity: 1; }
</style>
