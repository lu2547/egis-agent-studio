/**
 * docgen/ — DocGen 文档制作增强卡片组件
 *
 * - UploadCard.vue          文件上传卡片（拖拽 + 原生文件选择）
 * - WordEditorCard.vue      Word 编辑器卡片（iframe 嵌入 docx-editor）
 * - EntryCard.vue           统一入口卡片（Step1 选方式 + Step2 选方案）
 * - PensionIntroCard.vue    养老险优势介绍模板选择卡片
 * - DocxEditorDrawer.vue    docx-editor 右侧抽屉（养老险流程专用）
 * - InvestmentReportDrawer.vue 投资报告标化模板预留抽屉
 *
 * 这些组件检测 A2UI payload 中的自定义组件类型（FileUpload / DocgenEditor）。
 * 通用 A2UI payload（入口卡片、制作方式选择等）由 A2UICard 渲染。
 */

export { default as DocgenUploadCard } from './UploadCard.vue'
export { default as DocgenWordEditorCard } from './WordEditorCard.vue'
export { default as DocgenEntryCard } from './EntryCard.vue'
export { default as PensionIntroCard } from './PensionIntroCard.vue'
export { default as DocxEditorDrawer } from './DocxEditorDrawer.vue'
export { default as InvestmentReportDrawer } from './InvestmentReportDrawer.vue'

/** 检测 A2UI payload 是否包含 DocGen 自定义组件 */
export function isDocgenUploadPayload(payload: any): boolean {
  if (!payload?.components) return false
  return payload.components.some((c: any) => c.component?.FileUpload)
}

export function isDocgenEditorPayload(payload: any): boolean {
  if (!payload?.components) return false
  return payload.components.some((c: any) => c.component?.DocgenEditor)
}
