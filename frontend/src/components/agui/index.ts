/**
 * AGUI 卡片模块 — 聚合出口
 *
 * 自包含模块：把 studio 聊天前端的「A2UI 渲染引擎 + 各类卡片组件 + 辅助函数」
 * 全部收敛到本目录，可整目录复制到其他 Vue3 + TDesign 工程复用。
 *
 * 对外依赖仅：marked(npm) + TDesign 全局组件（t-icon / t-swiper），不反向依赖 views。
 *
 * 目录组织（按卡片类型）：
 *   - a2ui/          通用 A2UI 渲染引擎 + A2UICard 容器
 *   - thinking/      推理文本卡片
 *   - todo/          todo_write 计划卡片
 *   - outline/       可编辑大纲卡片（非 A2UI，独立 frontend_digest 通道）
 *   - svg-preview/   SVG 实时预览（非 A2UI，独立 custom 通道）
 *
 * 各子目录均有独立 index.ts，可精确导入；本文件聚合所有子模块，方便 `import { ... } from '@/components/agui'`。
 *
 * 复用三步法见 README.md。
 */

// ===== a2ui/ =====
export { default as A2UICard } from './a2ui/A2UICard.vue'
export { escHtml, isA2UIPayload, normalizeToolDisplayEvent, renderA2UI } from './a2ui'

// ===== thinking/ =====
export { default as ThinkingCard } from './thinking/ThinkingCard.vue'

// ===== todo/ =====
export { default as TodoCard } from './todo/TodoCard.vue'
export {
  isTodoCard,
  todoTitle,
  todoSummary,
  todoStatus,
  todoSteps,
  activeStepId,
  finalizeTodoCard,
} from './todo/todoHelpers'
export type { TodoStep } from './todo/todoHelpers'

// ===== outline/ =====
export { default as OutlineCard } from './outline/OutlineCard.vue'
export type { OutlineItem } from './outline/OutlineCard.vue'

// ===== svg-preview/ =====
export { default as SvgPreview } from './svg-preview/SvgPreview.vue'
export { appendSvgPage } from './svg-preview/appendSvgPage'
export type { SvgPage, SvgPreviewPayload } from './svg-preview/types'

// ===== pptist-drawer/ =====
export { PPTistDrawer } from './pptist-drawer'

// ===== docgen/ =====
export {
  DocgenUploadCard,
  DocgenWordEditorCard,
  DocgenEntryCard,
  PensionIntroCard,
  DocxEditorDrawer,
  DocxDeliveryCard,
  InvestmentReportDrawer,
  isDocgenUploadPayload,
  isDocgenEditorPayload,
} from './docgen'
