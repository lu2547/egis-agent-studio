<template>
  <div v-if="hasText" v-scroll-bottom class="reasoning-inline" v-html="html"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'

/**
 * 推理文本卡片 — 灰色滚动条样式，内置 marked 渲染。
 * 自带 markdown 渲染，不依赖 views 层。
 */
const props = defineProps<{ text?: string }>()

marked.setOptions({ breaks: true, gfm: true })

const hasText = computed(() => !!(props.text && String(props.text).trim()))
const html = computed(() => (props.text ? (marked.parse(props.text) as string) : ''))

// 内容更新时自动滚动到底部（script setup 中变量名以 v 开头自动注册为 v-scroll-bottom 指令）
const vScrollBottom = {
  updated(el: HTMLElement) { requestAnimationFrame(() => { el.scrollTop = el.scrollHeight }) },
  mounted(el: HTMLElement) { el.scrollTop = el.scrollHeight },
}
</script>

<style scoped>
.reasoning-inline {
  max-height: 104px;
  overflow-y: auto;
  color: #999;
  font-size: 13px;
  line-height: 1.6;
  padding: 8px 12px;
  border-left: 3px solid #b5c7ee;
  background: #fafbfc;
  margin-top: 8px;
  border-radius: 6px;
}
.reasoning-inline :deep(p) { color: #999; margin: 4px 0; }
.reasoning-inline :deep(strong) { color: #888; font-weight: 500; }
.reasoning-inline :deep(code) { color: #888; background: rgba(0, 0, 0, 0.04); padding: 1px 4px; border-radius: 3px; }
.reasoning-inline :deep(ol), .reasoning-inline :deep(ul) { padding-left: 20px; margin: 4px 0; color: #999; }
</style>
