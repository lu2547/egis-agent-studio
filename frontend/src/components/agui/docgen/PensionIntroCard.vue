<script setup lang="ts">
import { ref, computed } from 'vue'

/**
 * 养老险优势介绍 — 模板版本选择卡片
 *
 * 展示 3 个版本选项（综合版 / HR版 / 财务版），用户选中后回传消息给 agent。
 * 复用 EntryCard 设计语言（#426cff 蓝色、圆角、isConfirmed 锁定）。
 */

interface VersionOption {
  id: string
  label: string
  audience: string
  section_count: number
  sections: string[]
}

const props = defineProps<{
  versions: VersionOption[]
}>()

const emit = defineEmits<{
  (e: 'action', data: { type: string; args: string }): void
}>()

const selectedVersion = ref<string | null>(null)
const isConfirmed = ref(false)

const selectedOption = computed(() => {
  if (!selectedVersion.value) return null
  return props.versions.find(v => v.id === selectedVersion.value) || null
})

function toggleVersion(vid: string) {
  if (isConfirmed.value) return
  selectedVersion.value = selectedVersion.value === vid ? null : vid
}

function confirmSelection() {
  if (!selectedOption.value || isConfirmed.value) return
  isConfirmed.value = true
  const event = {
    flow: 'docgen_pension_intro_flow',
    action: 'generate',
    template_id: 'pension_intro',
    version: selectedOption.value.id,
  }
  emit('action', {
    type: 'docgenEvent',
    args: JSON.stringify({
      event,
      display: `我选择${selectedOption.value.label}`,
    }),
  })
}
</script>

<template>
  <div class="pension-intro-card">
    <div class="card-title">选择模板版本</div>
    <p class="card-desc">请选择一个适合您的版本，AI 将基于知识库自动生成对应内容。</p>

    <div :class="['version-grid', { locked: isConfirmed }]">
      <div
        v-for="v in versions"
        :key="v.id"
        :class="['version-card', { selected: selectedVersion === v.id }]"
        @click="toggleVersion(v.id)"
      >
        <div class="version-card-top">
          <span class="version-label">{{ v.label }}</span>
          <span v-if="selectedVersion === v.id" class="version-check">✓</span>
          <span v-else class="tag">{{ v.section_count }}章</span>
        </div>
        <p class="version-audience">{{ v.audience }}</p>
        <div class="version-sections">
          <span v-for="sec in v.sections" :key="sec" class="section-chip">{{ sec }}</span>
        </div>
      </div>
    </div>

    <div class="card-footer">
      <button
        v-if="!isConfirmed"
        class="confirm-btn"
        :class="{ disabled: !selectedVersion }"
        :disabled="!selectedVersion"
        type="button"
        @click="confirmSelection"
      >
        确认选择
      </button>
      <span v-else class="confirmed-badge">✓ 已确认 · {{ selectedOption?.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.pension-intro-card {
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #e4e9f2;
  box-shadow: 0 8px 20px rgba(20, 34, 70, 0.06);
  overflow: hidden;
  padding: 16px;
}

.card-title {
  font-size: 16px;
  font-weight: 900;
  color: #1e2432;
  margin-bottom: 4px;
}

.card-desc {
  color: #666;
  font-size: 13px;
  margin: 0 0 12px;
  line-height: 1.5;
}

/* ── 版本网格 ── */
.version-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}

.version-card {
  position: relative;
  border: 1px solid #e4e9f2;
  border-radius: 8px;
  padding: 12px 14px;
  cursor: pointer;
  transition: all 0.18s ease;
  background: #fafbfe;
}

.version-card:hover {
  border-color: #a0b4ff;
  background: #f5f8ff;
}

.version-card.selected {
  border-color: #426cff;
  background: #eef3ff;
  box-shadow: 0 0 0 2px rgba(66, 108, 255, 0.15);
}

.version-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.version-label {
  font-size: 15px;
  font-weight: 900;
  color: #1e2432;
}

.tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
  color: #426cff;
  background: #eef3ff;
}

.version-audience {
  color: #666;
  font-size: 12px;
  line-height: 1.4;
  margin: 0 0 8px;
}

.version-sections {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.section-chip {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  color: #555;
  background: #f0f2f5;
}

.version-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #426cff;
  color: #fff;
  font-size: 11px;
  font-weight: 900;
  flex-shrink: 0;
}

/* ── 底部确认 ── */
.card-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.confirm-btn {
  height: 34px;
  padding: 0 20px;
  border: 0;
  border-radius: 6px;
  color: #fff;
  background: #426cff;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.confirm-btn:hover:not(.disabled) {
  filter: brightness(1.08);
}

.confirm-btn.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.confirmed-badge {
  height: 34px;
  padding: 0 14px;
  border-radius: 6px;
  color: #40aa68;
  background: #eafaf0;
  font-size: 13px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

/* ── 确认后锁定 ── */
.version-grid.locked {
  pointer-events: none;
}

.version-grid.locked .version-card {
  opacity: 0.5;
}

.version-grid.locked .version-card.selected {
  opacity: 1;
}
</style>
