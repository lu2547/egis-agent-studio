<template>
  <div class="agent-studio">
    <!-- 左侧：Agent 列表 -->
    <div class="studio-left">
      <div class="panel-header">
        <h3>Agent 列表</h3>
        <t-button size="small" @click="refreshAgents">
          <t-icon name="refresh" />
        </t-button>
      </div>
      <div class="agent-list">
        <div
          v-for="agent in agents"
          :key="agent.id"
          class="agent-item"
          :class="{ active: selectedAgent?.id === agent.id }"
          @click="selectAgent(agent)"
        >
          <div class="agent-name">{{ agent.name }}</div>
          <div class="agent-desc">{{ agent.description || '暂无描述' }}</div>
        </div>
      </div>
    </div>

    <!-- 中间：Skills & Tools -->
    <div class="studio-center">
      <div class="panel-header">
        <h3>Skills & Tools</h3>
        <t-input
          v-model="searchQuery"
          placeholder="搜索..."
          size="small"
          style="width: 200px"
        />
      </div>
      <div class="skills-tools">
        <div v-if="selectedAgent" class="skills-section">
          <h4>Skills</h4>
          <div class="item-list">
            <div v-for="skill in filteredSkills" :key="skill.name" class="item-card">
              <div class="item-header">
                <div class="item-name">{{ skill.name }}</div>
                <t-tag v-if="skill.source === 'core'" size="small" theme="primary">全局</t-tag>
                <t-tag v-else size="small" theme="success">Agent 专属</t-tag>
              </div>
              <div class="item-desc">{{ skill.description }}</div>
            </div>
          </div>
        </div>
        <div v-if="selectedAgent" class="tools-section">
          <h4>Tools</h4>
          <div class="item-list">
            <div v-for="tool in filteredTools" :key="tool.name" class="item-card">
              <div class="item-name">{{ tool.name }}</div>
              <div class="item-desc">{{ tool.description }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧：实时测试日志 -->
    <div class="studio-right">
      <div class="panel-header">
        <h3>测试日志</h3>
        <t-button size="small" @click="clearLogs">清空</t-button>
      </div>
      <div ref="logContainer" class="log-container">
        <div v-for="(log, idx) in logs" :key="idx" class="log-item">
          <span class="log-time">{{ log.time }}</span>
          <span :class="['log-level', log.level]">{{ log.level.toUpperCase() }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'

interface Agent {
  id: string
  name: string
  description: string
  skills: Array<{ name: string; description: string; source: string }>
  tools: Array<{ name: string; description: string }>
}

interface Log {
  time: string
  level: 'info' | 'warn' | 'error'
  message: string
}

const agents = ref<Agent[]>([])
const selectedAgent = ref<Agent | null>(null)
const searchQuery = ref('')
const logs = ref<Log[]>([])
const logContainer = ref<HTMLElement>()

// 过滤 skills 和 tools
const filteredSkills = computed(() => {
  if (!selectedAgent.value) return []
  const skills = selectedAgent.value.skills || []
  if (!searchQuery.value) return skills
  return skills.filter(s => s.name.toLowerCase().includes(searchQuery.value.toLowerCase()))
})

const filteredTools = computed(() => {
  if (!selectedAgent.value) return []
  const tools = selectedAgent.value.tools || []
  if (!searchQuery.value) return tools
  return tools.filter(t => t.name.toLowerCase().includes(searchQuery.value.toLowerCase()))
})

// 初始化
import { onMounted } from 'vue'
onMounted(async () => {
  await refreshAgents()
  // 模拟日志
  startLogSimulation()
})

async function refreshAgents() {
  console.log('[AgentStudio] Loading agents...')
  try {
    const res = await fetch('/api/agents')
    console.log('[AgentStudio] Response status:', res.status)
    const data = await res.json()
    console.log('[AgentStudio] Agents data:', data)
    agents.value = data.agents || []
    console.log('[AgentStudio] Loaded', agents.value.length, 'agents')
  } catch (e) {
    console.error('[AgentStudio] Failed to load agents:', e)
  }
}

function selectAgent(agent: Agent) {
  selectedAgent.value = agent
  addLog('info', `选择 Agent: ${agent.name}`)
}

function addLog(level: Log['level'], message: string) {
  const now = new Date()
  logs.value.push({
    time: now.toLocaleTimeString('zh-CN'),
    level,
    message
  })
  scrollToBottom()
}

function clearLogs() {
  logs.value = []
}

function scrollToBottom() {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
}

// 模拟日志（开发用）
function startLogSimulation() {
  const messages = [
    { level: 'info' as const, msg: 'Agent initialized' },
    { level: 'info' as const, msg: 'Loading skills...' },
    { level: 'warn' as const, msg: 'Tool not found, using fallback' },
    { level: 'info' as const, msg: 'Request processed successfully' },
  ]
  
  let idx = 0
  setInterval(() => {
    if (selectedAgent.value) {
      const { level, msg } = messages[idx % messages.length]
      addLog(level, msg)
      idx++
    }
  }, 3000)
}
</script>

<style scoped>
.agent-studio {
  display: flex;
  height: 100vh;
  gap: 1px;
  background: #e7e7e7;
}

.studio-left,
.studio-center,
.studio-right {
  background: #fff;
  display: flex;
  flex-direction: column;
}

.studio-left {
  width: 280px;
}

.studio-center {
  flex: 1;
}

.studio-right {
  width: 400px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e7e7e7;
}

.panel-header h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.agent-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.agent-item {
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 4px;
  transition: background 0.2s;
}

.agent-item:hover {
  background: #f5f5f5;
}

.agent-item.active {
  background: #e8f4ff;
}

.agent-name {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.agent-desc {
  font-size: 12px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skills-tools {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.skills-section,
.tools-section {
  margin-bottom: 24px;
}

.skills-section h4,
.tools-section h4 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #333;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item-card {
  padding: 12px;
  border: 1px solid #e7e7e7;
  border-radius: 8px;
  transition: box-shadow 0.2s;
}

.item-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.item-name {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.item-desc {
  font-size: 12px;
  color: #666;
}

.log-container {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background: #f8f9fa;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.log-item {
  padding: 4px 0;
  border-bottom: 1px solid #eee;
  display: flex;
  gap: 8px;
}

.log-time {
  color: #999;
  min-width: 80px;
}

.log-level {
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 10px;
}

.log-level.info {
  background: #e3f2fd;
  color: #1976d2;
}

.log-level.warn {
  background: #fff3e0;
  color: #f57c00;
}

.log-level.error {
  background: #ffebee;
  color: #d32f2f;
}

.log-message {
  flex: 1;
  color: #333;
}
</style>
