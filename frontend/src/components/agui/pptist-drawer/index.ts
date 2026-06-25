/**
 * pptist-drawer/ —— 内嵌 PPTist 的抽屉组件
 *
 * 用于"材料制作"agent 的标化制作流程：在抽屉内以 iframe 嵌入 PPTist 开发服务器，
 * 通过 postMessage 与 PPTist 双向通信（传递模板 slot 清单、AI patches 等 JSON）。
 */

export { default as PPTistDrawer } from './PPTistDrawer.vue'
