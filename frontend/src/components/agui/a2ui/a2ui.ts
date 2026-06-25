/**
 * A2UI 卡片渲染 + frontend_digest 事件标准化
 *
 * 纯函数，无 Vue 依赖。提供：
 * - isA2UIPayload：检测对象是否为 A2UI 组件 payload
 * - normalizeToolDisplayEvent：三协议统一提取 frontend_digest payload
 * - renderA2UI：递归将 A2UI 组件树渲染为 HTML 字符串
 */

import { marked } from 'marked'

// ===== 工具函数 =====

export function escHtml(v: string): string {
    return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ===== A2UI Payload 检测 =====

/** 检测是否为 A2UI payload（含 components 数组 + rootComponentId） */
export function isA2UIPayload(obj: any): boolean {
    if (!obj || typeof obj !== 'object') return false
    return Array.isArray(obj.components) && typeof obj.rootComponentId === 'string'
}

// ===== 三协议统一标准化 =====

/**
 * 标准化工具展示事件：兼容 internal / raw AGUI / enterprise AGUI 三种 SSE 事件格式
 *
 * - Internal:    evt='response.ui.component', d.ui_component = payload
 * - Raw AGUI:   evt='custom', d.custom_type='frontend_digest', d.custom_data = payload
 * - Enterprise: envelope, d.data.type='frontend_digest', d.data.ui_data = payload
 *
 * 返回提取到的 payload 或 null
 */
export function normalizeToolDisplayEvent(d: any): any | null {
    // Case 1: Internal — response.ui.component 事件
    if (d.type === 'response.ui.component' && d.ui_component) {
        return d.ui_component
    }
    // Case 2: Raw AGUI — custom 事件 with custom_type=frontend_digest
    if (d.type === 'custom' && d.custom_type === 'frontend_digest' && d.custom_data) {
        return d.custom_data
    }
    // Case 3: Enterprise AGUI — envelope with data.type=frontend_digest
    if (d.data?.type === 'frontend_digest' && d.data?.ui_data) {
        return d.data.ui_data
    }
    return null
}

// ===== A2UI 递归渲染 =====

/** 递归渲染 A2UI 组件树为 HTML 字符串 */
export function renderA2UI(payload: any): string {
    if (!payload) return ''
    const compMap = new Map<string, any>()
        ; (payload.components || []).forEach((c: any) => compMap.set(c.id, c.component))
    const data = payload.data || {}

    function resolveValue(binding: any, localData: any): string {
        if (!binding) return ''
        if (binding.path !== undefined) {
            if (localData && localData[binding.path] !== undefined) return String(localData[binding.path])
            const v = data[binding.path]
            return v !== undefined ? String(v) : ''
        }
        if (binding.literalString !== undefined) {
            return typeof binding.literalString === 'string'
                ? binding.literalString
                : JSON.stringify(binding.literalString)
        }
        return ''
    }

    function resolveRaw(binding: any, localData: any): any {
        if (!binding || typeof binding !== 'object') return binding
        if (binding.path !== undefined) {
            if (localData && localData[binding.path] !== undefined) return localData[binding.path]
            return data[binding.path]
        }
        if (binding.literalString !== undefined) return binding.literalString
        return undefined
    }

    function boxStyles(props: any): string {
        let s = ''
        if (props.width !== undefined)
            s += `width:${typeof props.width === 'number' ? props.width + '%' : props.width};`
        if (props.padding !== undefined) {
            if (Array.isArray(props.padding)) {
                const p = props.padding
                s += `padding:${p[0]}px ${p[3] || 0}px ${p[1] || 0}px ${p[2] || 0}px;`
            } else {
                s += `padding:${typeof props.padding === 'number' ? props.padding + 'px' : props.padding};`
            }
        }
        if (props.margin !== undefined) {
            if (Array.isArray(props.margin)) {
                const m = props.margin
                s += `margin:${m[0]}px ${m[3] || 0}px ${m[1] || 0}px ${m[2] || 0}px;`
            } else {
                s += `margin:${typeof props.margin === 'number' ? props.margin + 'px' : props.margin};`
            }
        }
        if (props.backgroundColor) s += `background-color:${props.backgroundColor};`
        if (props.borderRadius) {
            const rMap: Record<string, string> = { small: '4px', middle: '8px', big: '12px' }
            s += `border-radius:${rMap[props.borderRadius] || props.borderRadius};`
        }
        if (props.flex !== undefined) s += `flex:${props.flex};`
        return s
    }

    function renderChildren(props: any, localData: any): string {
        return ((props.children && props.children.explicitList) || []).map((id: string) => renderNode(id, localData)).join('')
    }

    function renderNode(compId: string, localData: any): string {
        const compDef = compMap.get(compId)
        if (!compDef) return ''
        const type = Object.keys(compDef)[0]
        const props = compDef[type] || {}

        // hide 属性
        if (props.hide !== undefined) {
            const hideVal = resolveRaw(props.hide, localData)
            if (hideVal === true || hideVal === 'true') return ''
        }

        switch (type) {
            case 'Column': {
                let style = 'display:flex;flex-direction:column;'
                if (props.gap) style += `gap:${typeof props.gap === 'number' ? props.gap + 'px' : props.gap};`
                if (props.alignment) {
                    const aMap: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' }
                    style += `align-items:${aMap[props.alignment] || props.alignment};`
                }
                style += boxStyles(props)
                return `<div style="${style}">${renderChildren(props, localData)}</div>`
            }
            case 'Row': {
                let style = 'display:flex;flex-direction:row;align-items:center;'
                if (props.gap) style += `gap:${typeof props.gap === 'number' ? props.gap + 'px' : props.gap};`
                if (props.distribution) {
                    const dMap: Record<string, string> = { spaceBetween: 'space-between', spaceAround: 'space-around', center: 'center', start: 'flex-start', end: 'flex-end' }
                    style += `justify-content:${dMap[props.distribution] || props.distribution};`
                }
                if (props.alignment) {
                    const aMap: Record<string, string> = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }
                    style += `align-items:${aMap[props.alignment] || props.alignment};`
                }
                style += boxStyles(props)
                return `<div style="${style}">${renderChildren(props, localData)}</div>`
            }
            case 'Card': {
                let style = 'display:flex;flex-direction:column;box-shadow:0 1px 6px rgba(0,0,0,.08);'
                if (!props.backgroundColor) style += 'background-color:#FFFFFF;'
                if (!props.borderRadius) style += 'border-radius:8px;'
                if (props.gap) style += `gap:${typeof props.gap === 'number' ? props.gap + 'px' : props.gap};`
                style += boxStyles(props)
                return `<div style="${style}">${renderChildren(props, localData)}</div>`
            }
            case 'Text': {
                let style = 'line-height:1.6;'
                if (props.color) style += `color:${props.color};`
                if (props.fontSize) style += `font-size:${props.fontSize};`
                if (props.bold) style += 'font-weight:bold;'
                if (props.italic) style += 'font-style:italic;'
                if (props.underline) style += 'text-decoration:underline;'
                style += boxStyles(props)
                return `<div style="${style}">${escHtml(resolveValue(props.text, localData))}</div>`
            }
            case 'Button': {
                let style = 'padding:6px 16px;border-radius:6px;cursor:pointer;font-size:13px;border:1px solid #ddd;'
                const btnType = resolveValue(props.type, localData) || props.type || ''
                if (btnType === 'primary') style += 'background:#0052d9;color:#fff;border:none;'
                if (props.width) style += `width:${typeof props.width === 'number' ? props.width + '%' : props.width};`
                // 注入 action 属性供前端绑定交互
                const action = props.action
                let actionAttrs = ''
                if (action) {
                    const actionType = typeof action === 'string' ? action : (action.type || '')
                    const actionArgs = typeof action === 'object' ? (action.args || action.message || '') : ''
                    actionAttrs = ` data-a2ui-action="${escHtml(actionType)}" data-a2ui-args="${escHtml(typeof actionArgs === 'string' ? actionArgs : JSON.stringify(actionArgs))}"`
                }
                // 如果有 url 属性，渲染为 <a> 标签
                const url = resolveValue(props.url, localData) || props.url
                if (url) {
                    return `<a href="${escHtml(url)}" target="_blank" rel="noopener" style="${style}text-decoration:none;display:inline-block;text-align:center;"${actionAttrs}>${escHtml(resolveValue(props.text, localData))}</a>`
                }
                return `<button style="${style}"${actionAttrs}>${escHtml(resolveValue(props.text, localData))}</button>`
            }
            case 'Divider': {
                const borderColor = props.borderColor || '#E5E5E5'
                return `<hr style="border:none;border-top:1px solid ${borderColor};margin:4px 0;">`
            }
            case 'Line': {
                let style = `background-color:${props.backgroundColor || '#E0E0E0'};flex-shrink:0;`
                if (props.minWidth) style += `min-width:${typeof props.minWidth === 'number' ? props.minWidth + 'px' : props.minWidth};`
                if (props.minHeight) style += `min-height:${typeof props.minHeight === 'number' ? props.minHeight + 'px' : props.minHeight};`
                if (props.borderRadius) {
                    const rMap: Record<string, string> = { small: '4px', middle: '8px', big: '12px' }
                    style += `border-radius:${rMap[props.borderRadius] || (typeof props.borderRadius === 'number' ? props.borderRadius + 'px' : props.borderRadius)};`
                }
                return `<div style="${style}"></div>`
            }
            case 'Tag': {
                let style = 'display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;'
                const tagColor = (props.color && typeof props.color === 'object') ? resolveValue(props.color, localData) : props.color
                const tagBg = (props.backgroundColor && typeof props.backgroundColor === 'object') ? resolveValue(props.backgroundColor, localData) : props.backgroundColor
                if (tagBg) {
                    style += `background-color:${tagBg};`
                    if (tagColor) style += `color:${tagColor};`
                } else if (tagColor) {
                    style += `color:${tagColor};background-color:#f0f0f0;`
                } else {
                    style += 'background-color:#E8EFFF;color:#0052d9;'
                }
                return `<span style="${style}">${escHtml(resolveValue(props.text, localData))}</span>`
            }
            case 'RichText': {
                let style = ''
                if (props.fontSize) style += `font-size:${props.fontSize};`
                if (props.color) style += `color:${props.color};`
                const html = marked.parse(resolveValue(props.text, localData)) as string
                return `<div style="${style}">${html}</div>`
            }
            case 'List': {
                let style = `display:flex;flex-direction:${props.direction === 'horizontal' ? 'row' : 'column'};`
                if (props.gap) style += `gap:${typeof props.gap === 'number' ? props.gap + 'px' : props.gap};`
                if (props.alignment) {
                    const aMap: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end' }
                    style += `align-items:${aMap[props.alignment] || props.alignment};`
                }
                style += boxStyles(props)

                let items: any[] = []
                if (props.dataSource) {
                    if (props.dataSource.path !== undefined) {
                        const raw = (localData && localData[props.dataSource.path] !== undefined)
                            ? localData[props.dataSource.path] : data[props.dataSource.path]
                        items = Array.isArray(raw) ? raw : []
                    } else if (props.dataSource.literalString !== undefined) {
                        items = Array.isArray(props.dataSource.literalString) ? props.dataSource.literalString : []
                    }
                }

                let inner = ''
                if (items.length === 0 && props.emptyChild) {
                    inner = renderNode(props.emptyChild, localData)
                } else {
                    items.forEach((item: any, idx: number) => {
                        const itemData = (typeof item === 'object' && item !== null)
                            ? item : { '$item': item, '$index': idx }
                        inner += renderNode(props.child, itemData)
                    })
                }
                return `<div style="${style}">${inner}</div>`
            }
            default:
                return `<div style="font-size:11px;color:#999;padding:2px 0;">[${type}]</div>`
        }
    }

    const root = renderNode(payload.rootComponentId, null)
    return `<div class="a2ui-rendered">${root}</div>`
}
