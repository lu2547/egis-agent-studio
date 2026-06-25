/**
 * 消息展示辅助函数 — AGUI minimal 模式（通用层）
 *
 * 本文件仅保留与 msg 对象本身相关的通用判断；
 * todo 卡片相关的数据提取与兑底逻辑已迁至 components/agui/todoHelpers.ts。
 */

/** 消息是否有正文内容（最终答案） */
export const hasContent = (msg: any): boolean =>
    !!(msg.content && String(msg.content).trim())

/** 是否有推理文本 */
export const hasReasoning = (msg: any): boolean =>
    !!(msg.reasoning && String(msg.reasoning).trim())
