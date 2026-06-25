/**
 * outline/ — 可编辑大纲卡片
 *
 * 展示 outline_card 工具推送的结构化大纲，支持拖拽调序 / 行内编辑 / 新增删除 / 确认回传。
 * 走 frontend_digest(tool_name='outline_card') 独立通道，非 A2UI 协议。
 */

export { default as OutlineCard } from './OutlineCard.vue'
export type { OutlineItem } from './OutlineCard.vue'
