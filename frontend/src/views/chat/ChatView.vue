<template>
  <div class="chat-view">
    <div class="chat-main">
      <!-- Agent 选择器 -->
      <div class="agent-selector">
        <t-select v-model="selectedAgent" placeholder="选择 Agent" style="width: 200px" @change="onAgentChange">
          <t-option v-for="agent in agents" :key="agent.id" :value="agent.id" :label="agent.name" />
        </t-select>
      </div>

      <!-- 消息列表 -->
      <div ref="messageContainer" class="message-container">
        <div v-if="messages.length === 0" class="empty-state">
          <div class="empty-icon">💬</div>
          <div class="empty-text">开始新的对话</div>
          <div class="empty-hint">选择 Agent 并发送消息</div>
        </div>

        <div v-for="(msg, idx) in messages" :key="idx" class="message-wrapper" :class="msg.role">
          <!-- 用户消息 -->
          <div v-if="msg.role === 'user'" class="message-item user">
            <div class="message-avatar">👤</div>
            <div class="message-bubble user-bubble">
              <div class="message-text">{{ msg.content }}</div>
            </div>
          </div>

          <!-- Assistant 消息（AGUI minimal: 组件化组合） -->
          <div v-else class="message-item assistant">
            <div class="message-avatar">🤖</div>
            <div class="message-bubble assistant-bubble">
              <!-- ① todo 计划卡片（原地刷新，内嵌推理文本） -->
              <TodoCard :card="msg.todoCard" :reasoning="msg.reasoning" />

              <!-- ② 无 todo 卡片时的推理兜底 -->
              <ThinkingCard v-if="!isTodoCard(msg.todoCard)" :text="msg.reasoning" />

              <!-- ③ A2UI 卡片组（select_method / std_redirect / docgen 卡片等） -->
              <template v-for="(a2ui, aIdx) in (msg.a2uiCards || [])" :key="'a2ui-' + aIdx">
                <!-- DocGen 文件上传卡片 -->
                <DocgenUploadCard
                  v-if="isDocgenUploadPayload(a2ui)"
                  :payload="a2ui"
                  @action="onA2UIAction"
                />
                <!-- DocGen Word 编辑器卡片 -->
                <DocgenWordEditorCard
                  v-else-if="isDocgenEditorPayload(a2ui)"
                  :payload="a2ui"
                  @action="onA2UIAction"
                />
                <!-- 通用 A2UI 卡片 -->
                <A2UICard
                  v-else
                  :payload="a2ui"
                  @action="onA2UIAction"
                />
              </template>

              <!-- ④ 可编辑大纲卡片（outline_card） -->
              <OutlineCard
                v-if="msg.outlineCard && msg.outlineCard.outline"
                class="outline-card-wrap"
                :outline="msg.outlineCard.outline"
                :document-type="msg.outlineCard.document_type"
                @confirm="onOutlineConfirm"
              />

              <!-- ④.5 DocGen 入口选择卡片（docgen_entry_flow） -->
              <DocgenEntryCard
                v-if="msg.entryCard"
                :payload="msg.entryCard"
                @action="onA2UIAction"
              />

              <!-- ④.6 养老险优势介绍模板选择卡片（docgen_pension_intro_flow / select_template） -->
              <PensionIntroCard
                v-if="msg.pensionIntroCard"
                :versions="msg.pensionIntroCard.versions"
                @action="onA2UIAction"
              />

              <!-- ④.6.5 材料制作分段进度 -->
              <div v-if="msg.docgenProgress && msg.docgenProgress.length" class="docgen-progress">
                <div class="docgen-progress-title">材料生成进度</div>
                <div
                  v-for="(item, pIdx) in msg.docgenProgress"
                  :key="'docgen-progress-' + pIdx"
                  class="docgen-progress-item"
                >
                  <span class="docgen-progress-dot">✓</span>
                  <span>{{ item.message }}</span>
                </div>
              </div>

              <!-- ④.7 文档交付完成卡片（可重新打开/下载文档） -->
              <DocxDeliveryCard
                v-if="msg.docxDrawer && msg.docxDrawer.action === 'delivered'"
                :payload="msg.docxDrawer"
                @action="onA2UIAction"
              />

              <!-- ⑤ SVG 实时预览（生成期间逐页推送） -->
              <SvgPreview
                v-if="msg.svgPages && msg.svgPages.length"
                :pages="msg.svgPages"
              />

              <!-- ⑥ 最终答案 -->
              <div
                v-if="hasContent(msg)"
                class="message-content"
                v-html="renderedAnswer(msg).html"
                @click="onAnswerClick($event)"
              ></div>

              <!-- 流式指示（仅在三块都为空时） -->
              <div v-if="msg.isStreaming && !hasContent(msg) && !hasReasoning(msg) && !isTodoCard(msg.todoCard)" class="streaming-indicator">
                <span class="dot"></span><span class="dot"></span><span class="dot"></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 输入框 -->
      <div class="input-area">
        <div v-if="agentUsesRag" class="rag-scope-bar">
          <t-button variant="outline" theme="default" class="scope-open-btn" @click="ragScopeVisible = true">
            <t-icon name="folder-open" />
            {{ selectedScopeBadges.length ? '已指定资料' : '资料范围' }}
          </t-button>
          <div class="scope-chip-list">
            <span v-for="badge in selectedScopeBadges" :key="badge.key" class="scope-chip">
              {{ badge.text }}
              <button type="button" aria-label="移除" @click.stop="removeSelectedScopeBadge(badge)">×</button>
            </span>
            <span v-if="selectedScopeBadges.length === 0" class="scope-placeholder">未指定时使用默认知识库范围</span>
          </div>
        </div>
        <div class="input-wrapper">
          <t-textarea v-model="inputValue" placeholder="输入消息... (Cmd/Ctrl + Enter 发送, Enter 换行)" :autosize="{ minRows: 1, maxRows: 5 }" @keydown="handleKeyDown" />
          <div class="input-actions">
            <div class="run-mode-toggle" role="group" aria-label="运行模式">
              <t-button
                size="small"
                :theme="runMode === 'flash' ? 'primary' : 'default'"
                :variant="runMode === 'flash' ? 'base' : 'outline'"
                :disabled="isLoading"
                @click="runMode = 'flash'"
              >
                Flash
              </t-button>
              <t-button
                size="small"
                :theme="runMode === 'pro' ? 'primary' : 'default'"
                :variant="runMode === 'pro' ? 'base' : 'outline'"
                :disabled="isLoading"
                @click="runMode = 'pro'"
              >
                Pro
              </t-button>
            </div>
            <t-button theme="primary" :disabled="!inputValue.trim() || isLoading" @click="sendMessage">
              <t-icon name="send" /> 发送
            </t-button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="ragScopeVisible" class="scope-modal-mask" @click.self="ragScopeVisible = false">
      <section class="scope-modal">
        <header class="scope-modal-header">
          <div>
            <h2>资料范围</h2>
            <p>按知识库、标签和文件限定本轮 RAG 检索范围</p>
          </div>
          <button type="button" aria-label="关闭" @click="ragScopeVisible = false">×</button>
        </header>
        <div class="scope-modal-body">
          <aside class="scope-library-sidebar">
            <div class="scope-search">
              <t-input v-model="kbSearchKeyword" placeholder="搜索知识库" clearable @enter="searchKnowledgeBases" @clear="searchKnowledgeBases" />
            </div>
            <div v-if="kbLoading" class="scope-loading">知识库加载中…</div>
            <template v-for="kb in kbOptions" :key="kb.id">
              <button
                type="button"
                class="library-row"
                :class="{ active: activeKb?.id === kb.id, selected: isKbSelected(kb.id) }"
                @click="activateKb(kb.id)"
              >
                <label class="library-check" @click.stop>
                  <input type="checkbox" :checked="isKbSelected(kb.id)" @change="toggleKb(kb)" />
                </label>
                <span class="library-name">{{ kb.name }}</span>
                <span class="kb-option-tag" :class="`kb-cat-${kb.category || 'unknown'}`">{{ kbCategoryLabel(kb.category) }}</span>
              </button>
              <div v-if="isKbSelected(kb.id) || activeKb?.id === kb.id" class="library-tag-tree">
                <label class="tree-check all-tag">
                  <input type="checkbox" :checked="isWholeKbSelected(kb.id)" @change="toggleWholeKb(kb)" />
                  <span>全部</span>
                </label>
                <label v-for="tag in tagsForKb(kb.id)" :key="tag.id" class="tree-check">
                  <input type="checkbox" :checked="isTagSelected(tag.id)" @change="toggleTag(tag)" />
                  <span>{{ tag.name }}</span>
                </label>
                <div v-if="!tagLoading && tagsForKb(kb.id).length === 0" class="tree-empty">暂无标签</div>
              </div>
            </template>
          </aside>
          <main class="scope-detail">
            <template v-if="activeKb">
              <div class="scope-detail-head">
                <div>
                  <h3>{{ activeKb.name }}</h3>
                  <p>选择标签可限定召回范围；选择文件会精确限定到文档。</p>
                </div>
                <t-button size="small" variant="outline" @click="toggleActiveWholeKb">
                  {{ isWholeKbSelected(activeKb.id) ? '取消全部' : '选择全部' }}
                </t-button>
              </div>
              <section class="scope-detail-section">
                <div class="file-section-head">
                  <h4>文件</h4>
                  <t-input v-model="scopeSearchKeyword" size="small" clearable :placeholder="`搜索 ${activeKb.name} 的标签和文件`" class="file-search" />
                </div>
                <div v-if="tagLoading || fileLoading" class="scope-loading">
                  {{ tagLoading ? '标签加载中…' : '文件加载中…' }}
                </div>
                <div class="file-list">
                  <label v-for="file in activeFiles" :key="file.id" class="file-item">
                    <input type="checkbox" :checked="isFileSelected(file.id)" @change="toggleFile(file)" />
                    <t-icon name="file" />
                    <span>{{ file.title || file.file_name }}</span>
                  </label>
                  <div v-if="!fileLoading && activeFiles.length === 0" class="scope-empty">当前范围暂无匹配文件</div>
                  <div v-if="fileLoading" class="scope-loading">文件加载中…</div>
                </div>
              </section>
            </template>
            <div v-else class="scope-empty-panel">暂无知识库</div>
          </main>
        </div>
        <footer class="scope-modal-footer">
          <div class="scope-chip-list modal-chips">
            <span v-for="badge in selectedScopeBadges" :key="badge.key" class="scope-chip">
              {{ badge.text }}
              <button type="button" aria-label="移除" @click.stop="removeSelectedScopeBadge(badge)">×</button>
            </span>
          </div>
          <div class="scope-modal-actions">
            <t-button variant="outline" @click="clearScope">清空</t-button>
            <t-button theme="primary" @click="ragScopeVisible = false">确认</t-button>
          </div>
        </footer>
      </section>
    </div>

    <ReferenceDrawer
      v-model:visible="drawerVisible"
      :drawer-ref="drawerRef"
      :loading="drawerLoading"
      :error="drawerError"
      :chunks="drawerChunks"
      :chunk-index="drawerChunkIndex"
    />

    <!-- PPTist 标化制作抽屉（材料制作 agent 专用） -->
    <PPTistDrawer
      :visible="pptistDrawerVisible"
      :init-data="pptistInitData"
      @update:visible="(v: boolean) => (pptistDrawerVisible = v)"
      @apply="onPPTistApply"
      @message="onPPTistMessage"
    />

    <!-- Docx 编辑器抽屉（养老险优势介绍流程专用） -->
    <DocxEditorDrawer
      :visible="docxDrawerVisible"
      :docx-url="docxDrawerUrl"
      :title="docxDrawerTitle"
      :confirmed="docxDrawerConfirmed"
      @update:visible="(v: boolean) => (docxDrawerVisible = v)"
      @action="onA2UIAction"
    />

    <InvestmentReportDrawer
      :visible="investmentReportDrawerVisible"
      :title="investmentReportDrawerTitle"
      @update:visible="(v: boolean) => (investmentReportDrawerVisible = v)"
      @action="onA2UIAction"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch, ref } from 'vue'
import { hasContent, hasReasoning } from './messageHelpers'
import { isTodoCard, TodoCard, A2UICard, ThinkingCard, OutlineCard, SvgPreview, PPTistDrawer, DocgenUploadCard, DocgenWordEditorCard, DocgenEntryCard, PensionIntroCard, DocxEditorDrawer, DocxDeliveryCard, InvestmentReportDrawer, isDocgenUploadPayload, isDocgenEditorPayload } from '@/components/agui'
import { useRag } from './useRag'
import { useChat } from './useChat'
import { useReferences } from './useReferences'
import ReferenceDrawer from './components/ReferenceDrawer.vue'

// === Composables 组装 ===
const rag = useRag()
const {
  kbOptions, scopeSearchKeyword,
  activeKb, activeFiles, selectedScopeBadges,
  kbLoading, tagLoading, fileLoading, agentUsesRag,
  activateKb, onKbSearch, toggleKb, toggleWholeKb, toggleTag, toggleFile,
  isKbSelected, isTagSelected, isFileSelected,
  tagsForKb, isWholeKbSelected,
  clearScope, removeSelectedScopeBadge, kbCategoryLabel,
} = rag
const ragScopeVisible = ref(false)
const kbSearchKeyword = ref('')

function searchKnowledgeBases() {
  onKbSearch(kbSearchKeyword.value)
}

function toggleActiveWholeKb() {
  if (activeKb.value) toggleWholeKb(activeKb.value)
}

const chat = useChat({
  getRagChanged: rag.getRagChanged,
  markRagSynced: rag.markRagSynced,
  resetRagFingerprint: rag.resetRagFingerprint,
  getRagPayload: rag.getRagPayload,
  hasRagScope: rag.hasRagScope,
  detectAgentRagDeps: rag.detectAgentRagDeps,
})
const {
  agents, selectedAgent, messages, inputValue, runMode, isLoading, messageContainer,
  loadAgents, loadChatDetail, onAgentChange, sendMessage, handleKeyDown, route,
} = chat

const {
  renderedAnswer, onAnswerClick,
  drawerVisible, drawerRef, drawerLoading, drawerChunks, drawerChunkIndex, drawerError,
} = useReferences()

// === A2UI 卡片按钮交互（来自 A2UICard emit('action', { type, args })） ===
// 所有 sendMessage 类型的按钮消息都发给 agent，由 skill 路由处理。
// 只有显式 type="openPPTist" 才直接打开 PPTist 抽屉。

function onA2UIAction({ type, args }: { type: string; args: string }) {
  if (type === 'openPPTist') {
    // 后端 a2ui payload 显式指定打开 PPTist，可携带 JSON args（模板 slot 清单 / 配置）
    let initData: any = null
    if (args) {
      try { initData = JSON.parse(args) } catch { initData = { raw: args } }
    }
    openPPTistDrawer(initData)
    return
  }
  if (type === 'sendMessage') {
    if (args) {
      inputValue.value = args
      sendMessage()
    }
    return
  }
  if (type === 'docgenEvent') {
    try {
      const payload = JSON.parse(args || '{}')
      const event = payload.event || {}
      const display = payload.display || '我已选择'
      sendMessage(display, { docgen_event: event })
    } catch (err) {
      console.warn('[ChatView] invalid docgenEvent action:', err, args)
    }
    return
  }
  if (type === 'openDocxDrawer') {
    try {
      const payload = JSON.parse(args || '{}')
      const url = payload.docx_url || payload.docxUrl || ''
      if (!url) return
      docxDrawerUrl.value = url
      docxDrawerTitle.value = payload.title || '文档查看'
      docxDrawerConfirmed.value = !!payload.confirmed
      docxDrawerVisible.value = true
    } catch (err) {
      console.warn('[ChatView] invalid openDocxDrawer action:', err, args)
    }
    return
  }
  console.warn('[ChatView] unsupported a2ui action type:', type)
}

// === 可编辑大纲卡片确认 ===
// 用户在卡片中调序/编辑后点「确认大纲」，将最终大纲 JSON 回传给 LLM 开始生成
function onOutlineConfirm(outline: any[]) {
  if (!Array.isArray(outline) || outline.length === 0) return
  const json = JSON.stringify(outline)
  inputValue.value = `我已确认大纲（共 ${outline.length} 项），请按以下最终大纲开始生成：\n\n\`\`\`json\n${json}\n\`\`\``
  sendMessage()
}

// === 材料制作 agent 抽屉 ===
const pptistDrawerVisible = ref(false)
const pptistInitData = ref<any>(null)

function openPPTistDrawer(initData: any) {
  pptistInitData.value = initData
  pptistDrawerVisible.value = true
}

// PPTist 点击「应用并回填」，回传 AI patches / 槽位 JSON
function onPPTistApply(payload: any) {
  if (!payload) return
  const json = JSON.stringify(payload, null, 2)
  // 预留口子：将 PPTist 输出 JSON 作为下一轮对话材料发送给材料制作 agent
  inputValue.value = `以下是我在 PPTist 中标化完成的模板数据（JSON），请据此继续后续处理：\n\n\`\`\`json\n${json}\n\`\`\``
  pptistDrawerVisible.value = false
  sendMessage()
}

// 来自 PPTist 的其他消息（日志 / 中间状态），暂仅 console
function onPPTistMessage(msg: any) {
  console.debug('[ChatView] PPTist message:', msg)
}

// === 养老险 Docx 编辑器抽屉 ===
const docxDrawerVisible = ref(false)
const docxDrawerUrl = ref('')
const docxDrawerTitle = ref('')
const docxDrawerConfirmed = ref(false)
const investmentReportDrawerVisible = ref(false)
const investmentReportDrawerTitle = ref('投资报告')
const investmentReportDrawerEventId = ref('')

// 监听消息中的 docxDrawer 数据（streamParser 设置）
watch(
  messages,
  (msgs) => {
    // 找最后一条包含 docxDrawer 的消息，自动打开抽屉
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i]
      if (m.docxDrawer && m.docxDrawer.action === 'show_docx') {
        const url = m.docxDrawer.docx_url || ''
        if (url && url !== docxDrawerUrl.value) {
          docxDrawerUrl.value = url
          docxDrawerTitle.value = m.docxDrawer.title || '平安养老险优势介绍'
          docxDrawerConfirmed.value = false
          docxDrawerVisible.value = true
        }
        break
      }
    }
  },
  { deep: true },
)

watch(
  messages,
  (msgs) => {
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i]
      if (m.investmentReportDrawer && m.investmentReportDrawer.action === 'show_drawer') {
        const eventId = m.investmentReportDrawer.event_id || `${i}:${m.investmentReportDrawer.title || '投资报告'}`
        if (eventId === investmentReportDrawerEventId.value) break
        investmentReportDrawerEventId.value = eventId
        investmentReportDrawerTitle.value = m.investmentReportDrawer.title || '投资报告'
        investmentReportDrawerVisible.value = true
        break
      }
    }
  },
  { deep: true },
)

// === 路由监听 ===
watch(
  () => route.params.id,
  async (chatId) => {
    if (isLoading.value) return
    if (chatId && typeof chatId === 'string') {
      await loadChatDetail(chatId)
    } else {
      messages.value = []
    }
  },
  { immediate: true },
)

onMounted(async () => {
  await loadAgents()
  await rag.loadKbDefaults()
});
</script>

<style scoped>
.chat-view { display: flex; height: 100vh; }
.chat-main { flex: 1; display: flex; flex-direction: column; background: #fafafa; }
.agent-selector { padding: 16px; background: #fff; border-bottom: 1px solid #e7e7e7; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.run-mode-toggle { display: inline-flex; gap: 6px; flex-shrink: 0; }
.rag-scope-bar { display: flex; gap: 12px; align-items: center; max-width: 900px; margin: 0 auto 12px auto; }
.scope-open-btn { flex-shrink: 0; }
.scope-chip-list { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; min-width: 0; }
.scope-chip { display: inline-flex; align-items: center; gap: 6px; max-width: 280px; padding: 4px 8px; border: 1px solid #d9e8ff; border-radius: 6px; background: #f5f9ff; color: #1f4e8c; font-size: 12px; line-height: 18px; }
.scope-chip button { border: 0; background: transparent; color: #6b7280; cursor: pointer; padding: 0 2px; font-size: 14px; line-height: 1; }
.scope-chip button:hover { color: #e34d59; }
.scope-placeholder { color: #999; font-size: 13px; }
.kb-option-tag { font-size: 11px; padding: 1px 6px; border-radius: 3px; line-height: 16px; flex-shrink: 0; }
.kb-cat-personal { color: #0052d9; background: #e8efff; }
.kb-cat-enterprise, .kb-cat-owner { color: #ed7b2f; background: #fff3e6; }
.kb-cat-public { color: #00a870; background: #e8f5ee; }
.kb-cat-unknown { color: #888; background: #f0f0f0; }
.message-container { flex: 1; overflow-y: auto; padding: 20px; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #999; }
.empty-icon { font-size: 64px; margin-bottom: 16px; }
.empty-text { font-size: 18px; font-weight: 500; margin-bottom: 8px; color: #666; }
.empty-hint { font-size: 14px; }
.message-item { display: flex; gap: 12px; margin-bottom: 24px; max-width: 900px; margin-left: auto; margin-right: auto; }
.message-item.user { flex-direction: row-reverse; }
.message-avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; background: #f0f0f0; }
.message-bubble { flex: 1; min-width: 0; }
.user-bubble { display: flex; flex-direction: column; align-items: flex-end; }
.assistant-bubble { position: relative; }
.message-text { padding: 12px 16px; border-radius: 12px; line-height: 1.6; word-wrap: break-word; background: #0052d9; color: #fff; border-top-right-radius: 4px; }
.message-content { padding: 12px 16px; border-radius: 12px; line-height: 1.6; background: #fff; border: 1px solid #e7e7e7; border-top-left-radius: 4px; margin-top: 8px; font-size: 14px; line-height: 1.8; }
.message-content :deep(p) { margin: 8px 0; }
.message-content :deep(pre) { background: #f6f8fa; padding: 14px; border-radius: 6px; overflow-x: auto; margin: 12px 0; }
.message-content :deep(code) { background: #f6f8fa; padding: 2px 6px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 0.9em; }
.message-content :deep(pre code) { background: none; padding: 0; }
.message-content :deep(h1), .message-content :deep(h2), .message-content :deep(h3) { margin: 16px 0 8px 0; font-weight: 600; }
.message-content :deep(ul), .message-content :deep(ol) { padding-left: 24px; margin: 8px 0; }
.message-content :deep(li) { margin: 4px 0; }
.message-content :deep(table) { border-collapse: collapse; margin: 12px 0; }
.message-content :deep(th), .message-content :deep(td) { border: 1px solid #e7e7e7; padding: 6px 12px; }
.message-content :deep(th) { background: #f6f8fa; }

/* 可编辑大纲卡片容器 */
.outline-card-wrap { margin: 8px 0; }
.docgen-progress { margin: 10px 0; padding: 12px 14px; background: #fff; border: 1px solid #d9e8ff; border-radius: 8px; color: #334155; }
.docgen-progress-title { font-size: 13px; font-weight: 600; color: #0052d9; margin-bottom: 8px; }
.docgen-progress-item { display: flex; align-items: center; gap: 8px; font-size: 13px; line-height: 1.6; }
.docgen-progress-dot { color: #00a870; font-weight: 700; }

/* Streaming */
.streaming-indicator { display: inline-flex; gap: 4px; padding: 10px 12px; }
.streaming-indicator .dot { width: 6px; height: 6px; border-radius: 50%; background: #0052d9; animation: bounce 1.4s infinite ease-in-out; }
.streaming-indicator .dot:nth-child(1) { animation-delay: -0.32s; }
.streaming-indicator .dot:nth-child(2) { animation-delay: -0.16s; }
@keyframes bounce { 0%,80%,100%{transform:scale(0);} 40%{transform:scale(1);} }

/* 输入区 */
.input-area { padding: 16px; background: #fff; border-top: 1px solid #e7e7e7; }
.input-wrapper { display: flex; gap: 12px; align-items: flex-end; max-width: 900px; margin: 0 auto; }
.input-wrapper :deep(.t-textarea) { flex: 1; }
.input-actions { display: flex; align-items: center; gap: 10px; }

@media (max-width: 720px) {
  .input-wrapper { flex-direction: column; align-items: stretch; }
  .input-actions { justify-content: flex-end; }
  .rag-scope-bar { align-items: flex-start; flex-direction: column; }
}

.scope-modal-mask { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 32px; background: rgba(15, 23, 42, 0.42); }
.scope-modal { width: min(960px, 100%); max-height: min(760px, calc(100vh - 64px)); display: flex; flex-direction: column; background: #fff; border-radius: 8px; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.24); overflow: hidden; }
.scope-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid #e7e7e7; }
.scope-modal-header h2 { margin: 0; font-size: 18px; color: #1f2937; }
.scope-modal-header p { margin: 4px 0 0; font-size: 12px; color: #6b7280; }
.scope-modal-header > button { width: 30px; height: 30px; border: 0; border-radius: 6px; background: #f3f4f6; color: #4b5563; cursor: pointer; font-size: 18px; }
.scope-modal-body { display: grid; grid-template-columns: 320px 1fr; min-height: 460px; overflow: hidden; }
.scope-library-sidebar { padding: 14px; border-right: 1px solid #e7e7e7; background: #fafafa; overflow-y: auto; }
.scope-search { margin-bottom: 12px; }
.library-row { width: 100%; display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 9px 10px; border: 1px solid transparent; border-radius: 6px; background: transparent; text-align: left; cursor: pointer; }
.library-row:hover { background: #f1f5ff; }
.library-row.active { border-color: #b5c7ee; background: #eef5ff; }
.library-row.selected .library-name { color: #0052d9; font-weight: 600; }
.library-check { display: flex; align-items: center; justify-content: center; }
.library-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #374151; font-size: 13px; }
.library-tag-tree { margin: 2px 0 10px 28px; padding-left: 10px; border-left: 1px solid #e1e7f0; display: grid; gap: 7px; }
.tree-check { min-width: 0; display: flex; align-items: center; gap: 7px; color: #374151; font-size: 12px; line-height: 1.35; cursor: pointer; }
.tree-check input { width: 14px; height: 14px; accent-color: #0052d9; flex-shrink: 0; }
.tree-check span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tree-check.all-tag { color: #0052d9; font-weight: 700; }
.tree-empty { padding: 2px 0 4px; color: #9ca3af; font-size: 12px; }
.scope-detail { min-width: 0; padding: 18px; overflow-y: auto; background: #fff; }
.scope-detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.scope-detail-head h3 { margin: 0; font-size: 17px; color: #111827; }
.scope-detail-head p { margin: 4px 0 0; font-size: 12px; color: #6b7280; }
.scope-detail-section { margin-top: 16px; }
.scope-detail-section h4, .file-section-head h4 { margin: 0 0 10px; font-size: 14px; color: #374151; }
.file-section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.file-search { width: 240px; }
.file-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px; }
.file-item { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 9px 10px; border: 1px solid #e5e7eb; border-radius: 6px; background: #fff; color: #374151; font-size: 13px; cursor: pointer; }
.file-item:hover { border-color: #b5c7ee; background: #f8fbff; }
.file-item span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scope-loading, .scope-empty, .scope-empty-panel { color: #9ca3af; font-size: 13px; padding: 12px 0; }
.scope-empty-panel { display: flex; height: 100%; align-items: center; justify-content: center; }
.scope-modal-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 18px; border-top: 1px solid #e7e7e7; background: #fafafa; }
.modal-chips { flex: 1; max-height: 72px; overflow-y: auto; }
.scope-modal-actions { display: flex; gap: 10px; flex-shrink: 0; }

/* 编号徽章（正文中的引用号） */
.message-content :deep(.ref-badge) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  margin: 0 2px;
  border-radius: 9px;
  background: #e8efff;
  color: #0052d9;
  font-size: 11px;
  line-height: 1;
  font-weight: 600;
  cursor: pointer;
  vertical-align: 2px;
  border: 1px solid #b5c7ee;
  transition: background .15s, box-shadow .15s;
  text-decoration: none;
}
.message-content :deep(.ref-badge:hover) {
  background: #d6e4ff;
  box-shadow: 0 1px 4px rgba(0,82,217,0.18);
}
</style>

<style>
.rag-select-popup .t-popup__content { overflow-x: auto; }
.rag-select-popup .t-select__list, .rag-select-popup .t-select-option, .rag-select-popup .t-select-option__content, .rag-select-popup .t-checkbox__label { white-space: nowrap; overflow: visible; text-overflow: clip; }

/* Citation float popup */
.kb-float-popup { position: fixed; z-index: 9999; max-width: 520px; min-width: 220px; background: #fff; border: 1px solid #e0e0e0; border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,0.12); padding: 14px 16px; font-size: 13px; line-height: 1.65; color: #333; pointer-events: auto; }
.kb-float-popup .float-title { font-weight: 600; font-size: 13px; color: #0052d9; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #e8efff; }
.kb-float-popup .float-content { max-height: 260px; overflow-y: auto; font-size: 13px; color: #444; word-break: break-word; white-space: pre-wrap; }
.kb-float-popup .float-meta { margin-top: 8px; font-size: 11px; color: #999; text-align: right; }
.kb-float-popup .float-loading { color: #999; padding: 12px 0; text-align: center; }
.kb-float-popup .float-error { color: #e34d59; padding: 8px 0; text-align: center; }
</style>
