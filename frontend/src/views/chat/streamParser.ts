import { appendSvgPage, finalizeTodoCard } from '@/components/agui'

/**
 * SSE 事件流处理器 — AGUI minimal 模式专用
 *
 * 仅识别 3 种事件：
 *   - custom (custom_type=frontend_digest, tool_name ∈ 白名单) → todo_write 卡片
 *   - custom (custom_type=svg_preview)                             → SVG 实时预览页（msg.svgPages）
 *   - text_message_content                                          → 追加 delta 到 msg.reasoning（推理区）
 *   - run_finished                                                  → 最终答案
 *
 * 白名单工具：
 *   - todo_write   → 原地刷新 msg.todoCard
 *   - outline_card → 原地刷新 msg.outlineCard（可编辑大纲卡片）
 *   - docgen_entry_flow → 原地刷新 msg.entryCard（入口选择卡片）
 *
 * 其余事件（tool_call_start / step_started / tool_call_result /
 * custom 非白名单 / state_* 等）全部丢弃。
 */

/** SSE 处理上下文 */
export interface StreamContext {
    msg: any
    startTime: number
    agentSessionId: string
    currentChatId: string
    /** 回调：首次收到 session_id 时通知外层持久化 */
    onSessionId?: (id: string) => void
    /** 回调：需要触发滚动 */
    onScroll?: () => void
}

const WHITELIST = new Set([
    'todo_write',
    'outline_card',
    'docgen_entry_flow',
    'docgen_pension_intro_flow',
    'docgen_investment_report_flow',
])

/** 处理单条 SSE 事件 */
export function handleSSEEvent(d: any, ctx: StreamContext): void {
    const evt = d.type || ''
    const msg = ctx.msg

    // ====== 捕获 session_id ======
    if (d.session_id && !ctx.agentSessionId) {
        ctx.agentSessionId = d.session_id
        ctx.onSessionId?.(d.session_id)
    }

    // ====== 事件路由 ======

    if (evt === 'custom') {
        handleCustomEvent(d, msg, ctx)
    } else if (evt === 'text_message_content' && d.content_kind === 'a2ui' && d.custom_data) {
        // A2UI 卡片事件（必须在普通 text_message_content 之前拦截）
        if (!Array.isArray(msg.a2uiCards)) msg.a2uiCards = []
        msg.a2uiCards.push(d.custom_data)
        ctx.onScroll?.()
    } else if (evt === 'text_message_content') {
        // 推理文本流：追加 delta 到 msg.reasoning
        const delta = typeof d.delta === 'string' ? d.delta : ''
        if (delta) {
            msg.reasoning = (msg.reasoning || '') + delta
            ctx.onScroll?.()
        }
    } else if (evt === 'run_finished') {
        handleRunFinished(d, msg, ctx)
    } else if (evt === 'run_error') {
        // 错误兜底（虽不在白名单，但用户应能看到失败原因）
        msg.content = (msg.content || '') + `\n\n**出错:** ${d.error_message || '未知错误'}`
        msg.isStreaming = false
        // RUN_LIMIT 等场景会走 run_error 而非 run_finished，
        // 必须同样 finalize todo 卡片，否则步骤会一直转圈
        finalizeTodoCard(msg.todoCard)
    }
    // 其余事件一律忽略
}

// ====== 内部 handler ======

function handleCustomEvent(d: any, msg: any, ctx: StreamContext): void {
    // SVG 实时预览：生成期间每写一张 SVG 推一条，原地累加到 msg.svgPages
    if (d.custom_type === 'svg_preview') {
        handleSvgPreview(d, msg, ctx)
        return
    }
    if (d.custom_type !== 'frontend_digest') {
        console.debug('[SSE] custom non-digest:', d.custom_type, d)
        return
    }
    const payload = d.custom_data
    if (!payload) return
    console.debug('[SSE] frontend_digest:', payload.tool_name, payload)
    if (!WHITELIST.has(payload.tool_name)) return

    if (payload.tool_name === 'todo_write') {
        // 同一卡片原地刷新
        msg.todoCard = payload
    } else if (payload.tool_name === 'outline_card') {
        // 可编辑大纲卡片（payload 含 outline 数组 + document_type）
        msg.outlineCard = payload
    } else if (payload.tool_name === 'docgen_entry_flow') {
        // DocGen 入口选择卡片
        msg.entryCard = payload
    } else if (payload.tool_name === 'docgen_pension_intro_flow') {
        // 养老险优势介绍：按 action 分发
        if (payload.action === 'select_template') {
            msg.pensionIntroCard = payload
        } else if (payload.action === 'show_docx') {
            msg.docxDrawer = payload
        }
    } else if (payload.tool_name === 'docgen_investment_report_flow') {
        if (payload.action === 'show_drawer') {
            msg.investmentReportDrawer = payload
        }
    }

    ctx.onScroll?.()
}

/** SVG 实时预览：累加单页到 msg.svgPages（去重升序逻辑见 appendSvgPage） */
function handleSvgPreview(d: any, msg: any, ctx: StreamContext): void {
    if (!Array.isArray(msg.svgPages)) msg.svgPages = []
    const written = appendSvgPage(msg.svgPages, d.custom_data)
    if (written !== null) ctx.onScroll?.()
}

function handleRunFinished(d: any, msg: any, ctx: StreamContext): void {
    msg.content = d.message || ''
    msg.elapsed = Math.max(1, Math.round((Date.now() - ctx.startTime) / 1000))
    msg.isStreaming = false
    // 兑底：根据 todoCard 步骤状态决定是否将 in_progress 标为 completed
    finalizeTodoCard(msg.todoCard)
    ctx.onScroll?.()
}
