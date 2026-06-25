import type { SvgPage, SvgPreviewPayload } from './types'

/**
 * 将一条 svg_preview 事件 payload 累加进 pages 数组（原地修改）。
 *
 * 去重规则：按 page 唯一——同页已存在则替换为最新 svg，否则插入并按
 * page 升序排序。这样无论事件到达顺序如何，pages 始终保持页码有序。
 *
 * @param pages   目标数组（会被原地修改）
 * @param payload 后端 svg_preview 事件的 custom_data
 * @returns 实际写入的页码；payload 无效（缺 svg）时返回 null
 */
export function appendSvgPage(
    pages: SvgPage[],
    payload: SvgPreviewPayload | undefined | null,
): number | null {
    if (!payload || !payload.svg) return null
    const page = Number(payload.page) || pages.length + 1
    const item: SvgPage = {
        page,
        file_name: payload.file_name || '',
        svg: payload.svg,
    }
    const existing = pages.findIndex((p) => p.page === page)
    if (existing >= 0) {
        pages[existing] = item
    } else {
        pages.push(item)
        pages.sort((a, b) => a.page - b.page)
    }
    return page
}
