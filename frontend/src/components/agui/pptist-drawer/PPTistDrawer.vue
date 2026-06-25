<template>
  <t-drawer
    v-model:visible="visible"
    :size="drawerSize"
    placement="right"
    :close-btn="true"
    :footer="false"
    :header="'PPTist · 模板标化制作'"
    class="pptist-drawer"
    @close="onClose"
  >
    <div class="pptist-drawer-body">
      <div v-if="iframeLoading" class="pptist-loading">
        <t-loading size="small" /> 正在加载 PPTist…
      </div>
      <iframe
        ref="iframeRef"
        :src="iframeSrc"
        class="pptist-iframe"
        :class="{ loaded: !iframeLoading }"
        allow="clipboard-read; clipboard-write"
        @load="onIframeLoad"
      />
    </div>

    <!-- 抽屉底部工具条（预留 AI 回填入口） -->
    <div class="pptist-drawer-footer">
      <t-button theme="default" @click="sendToIframe('ping')">
        <t-icon name="send" /> 测试通信
      </t-button>
      <t-button theme="primary" @click="onApply">
        <t-icon name="check" /> 应用并回填
      </t-button>
    </div>
  </t-drawer>
</template>

<script setup lang="ts">
/**
 * PPTistDrawer —— 内嵌 PPTist 开发服务器的抽屉组件
 *
 * 功能：
 * 1. 以 iframe 方式嵌入 PPTist（默认 http://127.0.0.1:5173）
 * 2. 双向通信通过 window.postMessage：
 *    - 打开时向 PPTist 发送：{ type: 'pptist-init', payload: initData }
 *    - 接收 PPTist 回传：{ type: 'pptist-patch' | 'pptist-apply', data: any }
 * 3. 对外暴露 sendToIframe(type, data) 供父组件向 PPTist 推送数据（如 AI patches）
 */
import { ref, watch, nextTick, onBeforeUnmount, onMounted } from 'vue'

const props = defineProps<{
  /** 抽屉是否可见 */
  visible: boolean
  /** PPTist 开发服务器地址（带协议端口） */
  iframeSrc?: string
  /** 抽屉宽度 */
  drawerSize?: string
  /** 初始化时透传给 PPTist 的任意 JSON（模板 slot 清单、AI patches 等） */
  initData?: any
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'apply', payload: any): void
  (e: 'message', msg: any): void
  (e: 'loaded'): void
}>()

const visible = ref<boolean>(!!props.visible)
watch(
  () => props.visible,
  (v) => {
    visible.value = v
    if (v) nextTick(() => postInitMessage())
  },
)

const iframeRef = ref<HTMLIFrameElement | null>(null)
const iframeLoading = ref(true)
const iframeSrc = ref<string>(props.iframeSrc || 'http://127.0.0.1:5173')
const drawerSize = ref<string>(props.drawerSize || '90%')

// === postMessage 双向通信 ===

function postInitMessage() {
  if (!iframeRef.value?.contentWindow) return
  try {
    iframeRef.value.contentWindow.postMessage(
      {
        type: 'pptist-init',
        payload: props.initData ?? null,
        ts: Date.now(),
      },
      '*',
    )
  } catch (e) {
    console.warn('[PPTistDrawer] postMessage failed:', e)
  }
}

function postToIframe(type: string, data: any = null) {
  if (!iframeRef.value?.contentWindow) {
    console.warn('[PPTistDrawer] iframe not ready')
    return
  }
  iframeRef.value.contentWindow.postMessage({ type, data, ts: Date.now() }, '*')
}

function onIframeMessage(ev: MessageEvent) {
  // 仅响应来自 PPTist 的消息（按 origin/协议前缀过滤）
  if (!ev.data || typeof ev.data !== 'object') return
  if (typeof ev.data.type !== 'string' || !ev.data.type.startsWith('pptist-')) return
  if (ev.data.type === 'pptist-apply') {
    emit('apply', ev.data.data ?? ev.data.payload)
  } else {
    emit('message', ev.data)
  }
}

function onIframeLoad() {
  iframeLoading.value = false
  postInitMessage()
  emit('loaded')
}

function onClose() {
  emit('update:visible', false)
}

function onApply() {
  // 通知 PPTist 回传最终 patches
  postToIframe('pptist-request-apply')
}

function sendToIframe(type: string, data: any = null) {
  postToIframe(type, data)
}

// === 生命周期 ===

onMounted(() => {
  window.addEventListener('message', onIframeMessage)
  if (visible.value) nextTick(() => postInitMessage())
})

onBeforeUnmount(() => {
  window.removeEventListener('message', onIframeMessage)
})

defineExpose({ sendToIframe, postToIframe })
</script>

<style scoped>
.pptist-drawer-body {
  height: calc(100% - 64px);
  display: flex;
  flex-direction: column;
}
.pptist-loading {
  padding: 16px;
  text-align: center;
  color: #666;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.pptist-iframe {
  flex: 1;
  width: 100%;
  border: 1px solid #e7e7e7;
  border-radius: 6px;
  background: #fff;
  min-height: 0;
  opacity: 0;
  transition: opacity 0.25s ease;
}
.pptist-iframe.loaded {
  opacity: 1;
}
.pptist-drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 0 0 0;
  border-top: 1px solid #eee;
}
</style>

<style>
/* 抽屉全局样式覆盖：让 t-drawer body 使用 flex 以便 iframe 填满 */
.pptist-drawer .t-drawer__body {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}
</style>
