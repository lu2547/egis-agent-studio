/**
 * SVG 实时预览 - 类型契约
 *
 * 数据流：后端逐页生成 SVG 时，通过 SSE custom 事件
 * (custom_type="svg_preview") 推送单页全文；前端用 appendSvgPage
 * 累加为 SvgPage[]，交给 <SvgPreview> 组件渲染。
 *
 * 该模块零业务依赖，可整体复制到其他前端工程复用。
 */

/** 单页 SVG 预览数据（组件渲染单元） */
export interface SvgPage {
    /** 页码（从 1 开始，用于去重与排序） */
    page: number
    /** 源文件名，如 "01_cover.svg" */
    file_name: string
    /** SVG 全文（直接 v-html 渲染，不经过下载接口/URL） */
    svg: string
}

/** 后端 svg_preview 事件 payload（SSE custom_data 原始结构） */
export interface SvgPreviewPayload {
    page?: number
    file_name?: string
    svg?: string
}
