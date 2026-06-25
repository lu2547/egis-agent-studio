# AGUI 卡片模块

自包含、整目录复制即可复用的 AGUI 聊天卡片组件库。

把 studio 聊天前端的「A2UI 渲染引擎 + 各类卡片组件 + 辅助函数」全部收敛到本目录，对外依赖仅：

- `marked`(npm) —— Markdown 渲染
- **TDesign 全局组件** —— `t-icon` / `t-swiper` / `t-swiper-item`（需要在宿主工程注册）

**不反向依赖 `views/`、`api/` 等业务层**，可整体拷贝到任意 Vue 3 + TDesign 工程直接使用。

---

## 目录结构

```
src/components/agui/
├── index.ts          # 统一出口（组件 + 引擎 + helper + 类型）
├── a2ui.ts           # 公共 A2UI 渲染引擎（纯函数，无 Vue 依赖）
├── A2UICard.vue      # A2UI 卡片：renderA2UI v-html + 按钮 click emit('action', args)
├── TodoCard.vue      # todo_write 计划卡片（步骤列表 + 底部 reasoning 槽）
├── todoHelpers.ts    # todo 数据提取 + 兜底（isTodoCard / todoTitle / todoSteps / finalizeTodoCard）
├── ThinkingCard.vue  # 推理文本卡片（内置 marked，自滚动）
├── OutlineCard.vue   # 可编辑大纲卡片（拖拽调序 / 行内编辑 / 确认提交）
├── svg-preview/      # SVG 实时预览（自包含子模块）
│   ├── types.ts
│   ├── appendSvgPage.ts
│   └── SvgPreview.vue
└── README.md         # 本文档
```

---

## 复用三步法

```ts
// 1. SSE 解析层：把事件 payload 挂到消息对象
import { appendSvgPage, finalizeTodoCard } from '@/components/agui'

function onSSE(d, msg) {
  if (d.type === 'custom' && d.custom_type === 'svg_preview') {
    if (!Array.isArray(msg.svgPages)) msg.svgPages = []
    appendSvgPage(msg.svgPages, d.custom_data)
  }
  if (d.type === 'custom' && d.custom_type === 'frontend_digest'
      && d.custom_data?.tool_name === 'todo_write') {
    msg.todoCard = d.custom_data
  }
  if (d.type === 'custom' && d.custom_type === 'frontend_digest'
      && d.custom_data?.tool_name === 'outline_card') {
    msg.outlineCard = d.custom_data
  }
  if (d.type === 'text_message_content' && d.content_kind === 'a2ui' && d.custom_data) {
    if (!Array.isArray(msg.a2uiCards)) msg.a2uiCards = []
    msg.a2uiCards.push(d.custom_data)
  }
  if (d.type === 'text_message_content' && !d.content_kind && typeof d.delta === 'string') {
    msg.reasoning = (msg.reasoning || '') + d.delta
  }
  if (d.type === 'run_finished') {
    finalizeTodoCard(msg.todoCard)    // 兜底：将 in_progress 标为 completed
  }
}
```

```vue
<!-- 2. 消息模板层：组合使用卡片组件 -->
<template>
  <TodoCard :card="msg.todoCard" :reasoning="msg.reasoning" />
  <ThinkingCard v-if="!isTodoCard(msg.todoCard)" :text="msg.reasoning" />
  <A2UICard
    v-for="(a2ui, aIdx) in (msg.a2uiCards || [])"
    :key="'a2ui-' + aIdx"
    :payload="a2ui"
    @action="onA2UIAction"
  />
  <OutlineCard
    v-if="msg.outlineCard?.outline"
    :outline="msg.outlineCard.outline"
    :document-type="msg.outlineCard.document_type"
    @confirm="onOutlineConfirm"
  />
  <SvgPreview v-if="msg.svgPages?.length" :pages="msg.svgPages" />
</template>

<script setup>
import {
  isTodoCard, TodoCard, A2UICard, ThinkingCard, OutlineCard, SvgPreview,
} from '@/components/agui'

function onA2UIAction(args) { inputValue.value = args; sendMessage() }
function onOutlineConfirm(outline) {
  inputValue.value = `我已确认大纲（共 ${outline.length} 项）...\n\n` +
    '```json\n' + JSON.stringify(outline) + '\n```'
  sendMessage()
}
</script>
```

```ts
// 3. 消息对象结构约定（前端内存态）
msg = {
  role: 'assistant',
  content: '',         // 最终答案 markdown（run_finished.message）
  reasoning: '',       // 推理文本流（text_message_content.delta 累加）
  todoCard: null,      // frontend_digest payload（tool_name='todo_write'）
  outlineCard: null,   // frontend_digest payload（tool_name='outline_card'）
  a2uiCards: [],       // A2UI 组件 payload 数组
  svgPages: [],        // SvgPage[]（按 page 升序，去重替换）
  isStreaming: true,
  elapsed: 0,
}
```

---

## 组件契约

| 组件           | Props                                                                          | Events                    | 用途                                       |
| -------------- | ------------------------------------------------------------------------------ | ------------------------- | ------------------------------------------ |
| `TodoCard`     | `card: any` (frontend_digest payload)<br/>`reasoning?: string`                 | —                         | todo_write 计划卡片，内嵌底部 reasoning 槽 |
| `A2UICard`     | `payload: any` (A2UI 组件树)                                                   | `action(args: string)`    | A2UI 卡片渲染 + 按钮交互冒泡               |
| `ThinkingCard` | `text?: string` (markdown)                                                     | —                         | 推理文本滚动展示                           |
| `OutlineCard`  | `outline: OutlineItem[]`<br/>`documentType?: string`<br/>`confirmed?: boolean` | `confirm(updatedOutline)` | 可编辑大纲（拖拽/编辑/确认）               |
| `SvgPreview`   | `pages: SvgPage[]`                                                             | —                         | SVG 实时预览（Swiper 翻页 + 缩略图）       |

### 纯函数 / Helper

| 函数                                                                                                    | 签名                                               | 用途                                                             |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| `escHtml(v)`                                                                                            | `(string) => string`                               | HTML 转义（`& < > "`）                                           |
| `isA2UIPayload(obj)`                                                                                    | `(any) => boolean`                                 | 检测对象是否 A2UI payload（含 `components` + `rootComponentId`） |
| `normalizeToolDisplayEvent(d)`                                                                          | `(any) => any \| null`                             | 三协议兼容提取 frontend_digest payload                           |
| `renderA2UI(payload)`                                                                                   | `(any) => string`                                  | 递归渲染 A2UI 组件树为 HTML                                      |
| `isTodoCard(card)`                                                                                      | `(any) => boolean`                                 | `card.tool_name === 'todo_write'`                                |
| `todoTitle(card)` / `todoSummary(card)` / `todoStatus(card)` / `todoSteps(card)` / `activeStepId(card)` | —                                                  | todo 卡片数据提取                                                |
| `finalizeTodoCard(card)`                                                                                | `(any) => void`                                    | run_finished 兜底：in_progress → completed                       |
| `appendSvgPage(pages, payload)`                                                                         | `(SvgPage[], SvgPreviewPayload) => number \| null` | SVG 单页累加（去重升序）                                         |

---

## 数据流图

```
后端 SSE 事件流
  │
  ├─ custom + custom_type=svg_preview       ──┐
  ├─ custom + custom_type=frontend_digest   ──┤  appendSvgPage / todoCard / outlineCard
  ├─ text_message_content + content_kind=a2ui─┤
  ├─ text_message_content（普通）              ──┤  reasoning delta 累加
  ├─ run_finished                              ──┤  content + finalizeTodoCard
  ├─ run_error                                 ──┤  content 错误兜底
  └─ session_id                                ──┴─ 持久化映射
                                               │
                                               ▼
                                          msg 内存对象
                                               │
                                               ▼
                                  ┌─ TodoCard ─┬─ ThinkingCard ─┐
                                  ├─ A2UICard                   │
                                  ├─ OutlineCard ── emit confirm│
                                  ├─ SvgPreview                 │
                                  └─ 最终答案 markdown ── 引用徽章 ── 抽屉
```

---

## 本次新增的 SSE 事件判断（相对基础 todo+answer 方案）

| #   | 事件条件                                                                       | 前端处理                                                           | 备注                             |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------ | -------------------------------- |
| 1   | `type='custom'` + `custom_type='svg_preview'`                                  | `appendSvgPage(msg.svgPages, d.custom_data)` → 累加 `<SvgPreview>` | **本次新增**，逐页推送，去重升序 |
| 2   | `type='custom'` + `custom_type='frontend_digest'` + `tool_name='outline_card'` | `msg.outlineCard = d.custom_data` → 渲染 `<OutlineCard>`           | **本次新增**，可编辑大纲         |
| 3   | `type='custom'` + `custom_type='frontend_digest'` + `tool_name='todo_write'`   | `msg.todoCard = d.custom_data` → 渲染 `<TodoCard>`                 | 既有，本次迁移至组件             |
| 4   | `type='text_message_content'` + `content_kind='a2ui'` + `custom_data`          | `msg.a2uiCards.push(d.custom_data)` → 渲染 `<A2UICard>`            | **本次新增/增强**                |
| 5   | `type='text_message_content'`（普通 delta）                                    | `msg.reasoning += d.delta`                                         | 推理文本流                       |
| 6   | `type='run_finished'` + `message`                                              | `msg.content = d.message`；`finalizeTodoCard(msg.todoCard)`        | 最终答案 + todo 兜底             |
| 7   | `type='run_error'` + `error_message`                                           | `msg.content += '出错: ' + d.error_message`                        | 错误兜底                         |
| 8   | `d.session_id` 首次出现                                                        | `ctx.onSessionId(d.session_id)`                                    | 持久化映射                       |

另含 `a2ui.ts` 中 `normalizeToolDisplayEvent` 的三协议兼容：

- **Internal**：`d.type === 'response.ui.component'`，payload 在 `d.ui_component`
- **Raw AGUI**：`d.type === 'custom'` + `custom_type='frontend_digest'`，payload 在 `d.custom_data`
- **Enterprise**：envelope 模式，`d.data?.type === 'frontend_digest'`，payload 在 `d.data?.ui_data`

---

## A2UI 按钮交互协议

`renderA2UI` 渲染 Button 时，会将 payload 中的 `action` 对象注入 `data-a2ui-*` 属性：

```html
<button data-a2ui-action="sendMessage" data-a2ui-args="确认使用方案 A">确认</button>
```

`<A2UICard>` 组件在点击时捕获并 `emit('action', args)`，由父级（通常是 ChatView）处理为发送消息：

```ts
function onA2UIAction(args: string) {
  inputValue.value = args
  sendMessage()
}
```

支持 `action.url` 时渲染为 `<a>` 标签，`target="_blank"` 跳转。

---

## 持久化策略

`saveMessagesToBackend`（见 `useChat.ts`）只持久化**可恢复**字段：

- ✅ `content` / `reasoning` / `todoCard` / `outlineCard` / `elapsed`
- ❌ `a2uiCards` / `svgPages`（实时事件，不持久化；刷新后不还原）

如需完整还原，可在后端存储扩展字段，前端 `loadChatDetail` 中回填。

---

## 依赖

| 类型                                    | 来源    | 说明                                          |
| --------------------------------------- | ------- | --------------------------------------------- |
| `marked`                                | npm     | Markdown 渲染（RichText 组件 + ThinkingCard） |
| `t-icon` / `t-swiper` / `t-swiper-item` | TDesign | 步骤图标 + SVG 翻页，需宿主工程全局注册       |
| Vue 3 `script setup`                    | Vue 3   | 全部使用 `<script setup lang="ts">`           |

**不依赖**：`views/chat/*`、`api/`、`useChat`、`useRag`、`markdown.ts`。

---

## 迁移清单（旧路径 → 新路径）

| 旧                                   | 新                                 |
| ------------------------------------ | ---------------------------------- |
| `views/chat/a2ui.ts`                 | `components/agui/a2ui.ts`          |
| `ChatView 内联 todo 模板`            | `components/agui/TodoCard.vue`     |
| `ChatView 内联 a2uiCards`            | `components/agui/A2UICard.vue`     |
| `ChatView 内联 reasoning`            | `components/agui/ThinkingCard.vue` |
| `messageHelpers.ts` todo 函数        | `components/agui/todoHelpers.ts`   |
| `streamParser.ts` `finalizeTodoCard` | `components/agui/todoHelpers.ts`   |
| `components/OutlineCard.vue`         | `components/agui/OutlineCard.vue`  |
| `components/svg-preview/`            | `components/agui/svg-preview/`     |
| `components/ThinkingDisplay.vue`     | 删除（零引用死代码）               |
| `components/ToolDigestRenderer.vue`  | 删除（零引用死代码）               |

引用路径同步更新：

- `views/chat/markdown.ts`：`import { escHtml } from './a2ui'` → `'@/components/agui'`
- `views/chat/streamParser.ts`：`appendSvgPage` + `finalizeTodoCard` 均从 `'@/components/agui'` 引入
- `views/chat/ChatView.vue`：所有卡片 import 统一指向 `'@/components/agui'`
- `views/chat/messageHelpers.ts`：精简为 `hasContent` / `hasReasoning` 通用判断

---

## 验证

- ✅ `vue-tsc --noEmit` 类型检查通过
- ✅ `vite build` 构建通过
- ✅ 卡片视觉与交互行为与迁移前一致
- ✅ `agui/` 目录可独立复制到其他 Vue 3 + TDesign 工程（仅依赖 marked + TDesign）
