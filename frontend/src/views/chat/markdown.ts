/**
 * Markdown 渲染 + 引用徽章（编号）预处理
 *
 * 导出：
 * - renderMarkdown:        纯 Markdown 渲染（推理区使用，不处理 <kb>）
 * - renderMessageContent:  最终答案渲染，返回 { html, references }
 * - loadChunkDetail:       加载某个 chunk 详情（供抽屉复用）
 * - getChunkCache:         获取已加载的缓存
 */

import { marked } from 'marked'
import { escHtml } from '@/components/agui'
import { getChunkById } from '@/api'

// ===== marked 配置 =====
marked.setOptions({ breaks: true, gfm: true })

// ===== 属性解析 =====

const ATTR_RE = /([\w-]+)\s*=\s*"([^"]*)"/g

function parseTagAttrs(s: string): Record<string, string> {
    const out: Record<string, string> = {}
    ATTR_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = ATTR_RE.exec(s)) !== null) out[m[1]] = m[2]
    return out
}

export interface MessageReference {
    index: number      // 从 1 开始的编号
    doc: string        // 文档名
    chunkId: string    // chunk_id
}

export interface RenderedMessage {
    html: string
    references: MessageReference[]
}

/**
 * 预处理最终答案文本：把 <kb /> 换成编号徽章，同时收集 references。
 * 去重规则：同一个 chunkId 复用同一个编号。
 */
function preprocessAnswer(content: string): { processed: string; references: MessageReference[] } {
    const refs: MessageReference[] = []
    const idIndex = new Map<string, number>()

    let processed = content.replace(
        /<kb\b([^>]*)\/>/g,
        (_m, attrStr: string) => {
            const a = parseTagAttrs(attrStr)
            const doc = a.doc || ''
            const chunkId = a.chunk_id || a.chunkId || ''
            if (!chunkId) return ''
            let idx = idIndex.get(chunkId)
            if (!idx) {
                idx = refs.length + 1
                idIndex.set(chunkId, idx)
                refs.push({ index: idx, doc, chunkId })
            }
            const safeId = escHtml(chunkId)
            const safeDoc = escHtml(doc)
            return `<sup class="ref-badge" data-ref-index="${idx}" data-chunk-id="${safeId}" data-doc="${safeDoc}" role="button" tabindex="0">${idx}</sup>`
        },
    )
    // 流式输出未闭合的 <kb 转义，防止 marked 吞后续内容
    processed = processed.replace(/<kb\b/g, '&lt;kb')
    return { processed, references: refs }
}

/** 纯 Markdown 渲染（推理区使用，不处理 <kb>） */
export function renderMarkdown(text: string): string {
    try {
        return marked.parse(text || '') as string
    } catch { return text || '' }
}

/**
 * Chunk 切片渲染：在主流程基础上补 GFM 表格空行
 * chunk 切片常常把表格表头紧贴在上一段文字之后（无空行），
 * GFM 规范要求表头前必须有空行才会识别为表格，否则降级为普通文本。
 * 这里在表头前自动补空行，只对抽屉等 chunk 展示场景生效。
 */
export function renderChunkMarkdown(text: string): string {
    try {
        return marked.parse(normalizeChunkTables(text || '')) as string
    } catch { return text || '' }
}

// 表格分隔行：|---|---|  或  | :---: | ---: |
const TABLE_SEP_RE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/
// 表格行（含 |，至少一个）
const TABLE_ROW_RE = /^\s*\|.*\|\s*$/

function normalizeChunkTables(text: string): string {
    const lines = text.split('\n')
    const out: string[] = []
    let i = 0
    while (i < lines.length) {
        const line = lines[i]
        if (TABLE_ROW_RE.test(line)) {
            // 收集连续的表格行块
            const block: string[] = []
            let j = i
            while (j < lines.length && TABLE_ROW_RE.test(lines[j])) {
                block.push(lines[j])
                j++
            }
            // 表格前补空行（GFM 要求）
            if (out.length > 0 && out[out.length - 1].trim() !== '') {
                out.push('')
            }
            out.push(...normalizeTableBlock(block))
            // 表格后补空行（防止后续文本被带进表格）
            if (j < lines.length && lines[j].trim() !== '') {
                out.push('')
            }
            i = j
        } else {
            out.push(line)
            i++
        }
    }
    return out.join('\n')
}

function parseRowCells(line: string): string[] {
    const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
    return trimmed.split('|').map((c) => c.trim())
}

function isSepCell(c: string): boolean {
    return /^:?-{3,}:?$/.test(c.trim())
}

/**
 * 对一段连续表格行进行范式化：
 * 1. 列数不齐 → 按最大列数补空 cell
 * 2. 缺分隔行 → 在第一行后插入一个合规的分隔行
 */
function normalizeTableBlock(block: string[]): string[] {
    if (block.length === 0) return block
    const rows = block.map(parseRowCells)
    // 分隔行位置（所有 cell 都是 --- 这种）
    const sepIdx = rows.findIndex((r) => r.length > 0 && r.every(isSepCell))
    // 最大列数（排除分隔行可能被人为写多的情况）
    const maxCols = Math.max(
        ...rows.map((r, i) => (i === sepIdx ? 0 : r.length)),
        1,
    )
    // 补齐列数
    const padded = rows.map((r, i) => {
        if (i === sepIdx) return new Array(maxCols).fill('---')
        const copy = r.slice()
        while (copy.length < maxCols) copy.push('')
        return copy.slice(0, maxCols)
    })
    // 缺分隔行 → 在第一行后插入
    if (sepIdx < 0) {
        padded.splice(1, 0, new Array(maxCols).fill('---'))
    }
    return padded.map((r) => '| ' + r.join(' | ') + ' |')
}

/** 最终答案渲染：返回 HTML + 引用列表 */
export function renderMessageContent(text: string): RenderedMessage {
    try {
        const { processed, references } = preprocessAnswer(text || '')
        const html = marked.parse(processed) as string
        return { html, references }
    } catch {
        return { html: text || '', references: [] }
    }
}

// ===== Chunk 详情加载（抽屉复用） =====

export interface ChunkCacheEntry {
    loading: boolean
    content?: string
    knowledgeId?: string
    chunkIndex?: number
    error?: string
}

const chunkCache = new Map<string, ChunkCacheEntry>()

export function getChunkCache(chunkId: string): ChunkCacheEntry | undefined {
    return chunkCache.get(chunkId)
}

export async function loadChunkDetail(chunkId: string): Promise<ChunkCacheEntry> {
    const existed = chunkCache.get(chunkId)
    if (existed && !existed.loading) return existed
    if (existed?.loading) return existed
    chunkCache.set(chunkId, { loading: true })
    try {
        const res = await getChunkById(chunkId)
        const data = res.data?.data
        const content = data?.content || ''
        const knowledgeId = data?.knowledge_id || ''
        const chunkIndex = Number(data?.chunk_index)
        const entry: ChunkCacheEntry = {
            loading: false,
            content: content || undefined,
            knowledgeId: knowledgeId || undefined,
            chunkIndex: Number.isFinite(chunkIndex) ? chunkIndex : undefined,
            error: content ? undefined : '该引用片段暂无内容',
        }
        chunkCache.set(chunkId, entry)
        return entry
    } catch (e: any) {
        const status = e?.response?.status
        let msg = '加载失败'
        if (status === 404) msg = '该引用片段未找到（可能已更新或被删除）'
        else if (status === 400) msg = '引用片段 ID 格式不正确'
        console.warn('[citation] loadChunkDetail 失败:', { chunkId, status, raw: e?.message })
        const entry: ChunkCacheEntry = { loading: false, error: msg }
        chunkCache.set(chunkId, entry)
        return entry
    }
}
