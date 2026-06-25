/**
 * a2ui/ — A2UI 通用渲染引擎 + 卡片组件
 *
 * - a2ui.ts          纯函数：escHtml / isA2UIPayload / normalizeToolDisplayEvent / renderA2UI
 * - A2UICard.vue     通用 A2UI 卡片容器（v-html + 按钮 click 委托 emit('action')）
 *
 * 被 todo/ / outline/ / svg-preview/ 等兄弟模块按需引用。
 */

export { default as A2UICard } from './A2UICard.vue'
export { escHtml, isA2UIPayload, normalizeToolDisplayEvent, renderA2UI } from './a2ui'
