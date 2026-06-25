/**
 * todo_write 计划卡片 — 数据提取 + 兜底逻辑
 *
 * 所有函数以「卡片 payload（frontend_digest）」为中心，不依赖 msg/Vue，
 * 可整体复制复用。卡片结构：
 *   { tool_name:'todo_write', view:{title,summary,status}, sections:[{content_type:'checklist', data:[{id,text,status}]}] }
 */

/** 单个待办步骤 */
export interface TodoStep {
    id: string
    text: string
    status: string
}

/** 是否为 todo_write 计划卡片 */
export const isTodoCard = (card: any): boolean =>
    !!(card && card.tool_name === 'todo_write')

/** 卡片标题 */
export const todoTitle = (card: any): string =>
    card?.view?.title || '任务计划'

/** 进度摘要（如 "2/4 个步骤已完成"） */
export const todoSummary = (card: any): string =>
    card?.view?.summary || ''

/** 卡片状态: success / loading / info / warning / in_progress */
export const todoStatus = (card: any): string =>
    card?.view?.status || 'info'

/** 步骤列表 [{id,text,status}] */
export const todoSteps = (card: any): TodoStep[] => {
    const sections = card?.sections
    if (!Array.isArray(sections)) return []
    const checklist = sections.find((s: any) => s.content_type === 'checklist')
    return Array.isArray(checklist?.data) ? checklist.data : []
}

/**
 * 当前活跃步骤 id。
 * 优先级：最后一个 in_progress > 最后一个 completed > 最后一步。
 */
export const activeStepId = (card: any): string | null => {
    const steps = todoSteps(card)
    if (!steps.length) return null
    for (let i = steps.length - 1; i >= 0; i--) {
        if (steps[i].status === 'in_progress') return steps[i].id
    }
    for (let i = steps.length - 1; i >= 0; i--) {
        if (steps[i].status === 'completed') return steps[i].id
    }
    return steps[steps.length - 1].id
}

/**
 * 兜底逻辑：run_finished 后，根据步骤状态决定是否把 in_progress 标为 completed。
 * 若仍有 blocked/pending 步骤（如等待用户确认），说明任务未完成，跳过兜底。
 *
 * @param card msg.todoCard（会被原地修改）
 */
export function finalizeTodoCard(card: any): void {
    if (!card) return
    const sections = card.sections
    if (!Array.isArray(sections)) return
    const checklist = sections.find((s: any) => s.content_type === 'checklist')
    const steps = Array.isArray(checklist?.data) ? checklist.data : null
    if (!steps || steps.length === 0) return

    // 有 blocked 或 pending 步骤 → 任务未完成，跳过兜底
    const hasUnfinished = steps.some((s: any) => s.status === 'blocked' || s.status === 'pending')
    if (hasUnfinished) return

    let changed = false
    for (const step of steps) {
        if (step.status === 'in_progress') {
            step.status = 'completed'
            changed = true
        }
    }
    if (!changed) return

    const total = steps.length
    const completed = steps.filter((s: any) => s.status === 'completed').length
    if (card.view) {
        if (completed >= total) {
            card.view.summary = `全部 ${total} 个步骤已完成`
            card.view.status = 'success'
        } else {
            card.view.summary = `${completed}/${total} 个步骤已完成`
            card.view.status = 'in_progress'
        }
    }
}
