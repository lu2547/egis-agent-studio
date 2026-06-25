/**
 * svg-preview/ — SVG 实时预览卡片
 *
 * PPTMaster 每写完一张 SVG，后端推一条 custom_type='svg_preview' 事件；
 * 前端用 appendSvgPage 累积 SvgPage[]，交给 <SvgPreview> 组件 Swiper 翻页渲染。
 */

export { default as SvgPreview } from './SvgPreview.vue'
export { appendSvgPage } from './appendSvgPage'
export type { SvgPage, SvgPreviewPayload } from './types'
