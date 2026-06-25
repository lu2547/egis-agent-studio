<template>
  <div class="layout-container">
    <!-- 左侧边栏 -->
    <div class="aside_box">
      <!-- Logo -->
      <div class="logo_row">
        <div class="logo_box">
          <span class="logo_text">egis-agents</span>
          <span class="logo_sub">studio</span>
        </div>
      </div>
      
      <!-- 菜单项 -->
      <div class="menu_top">
        <!-- Agent 管理菜单 -->
        <div class="menu_item" :class="{ 'menu_item_active': isActive('/agents') }" @click="goTo('/agents')">
          <div class="menu_item-box">
            <div class="menu_icon">
              <t-icon name="user-circle" size="20px" />
            </div>
            <span class="menu_title">Agent 管理</span>
          </div>
        </div>
        
        <!-- 对话菜单 -->
        <div class="menu_box">
          <div class="menu_item" :class="{ 'menu_item_active': isActive('/chat') }" @click="goTo('/chat')">
            <div class="menu_item-box">
              <div class="menu_icon">
                <t-icon name="chat" size="20px" />
              </div>
              <span class="menu_title">对话</span>
              <span class="menu-create-hint" @click.stop="createNewChat"><t-icon name="add" /></span>
            </div>
          </div>
          
          <!-- 对话列表（带时间分组） -->
          <div class="submenu">
            <template v-for="group in groupedChats" :key="group.label">
              <div class="timeline_header">{{ group.label }}</div>
              <div class="submenu_item_p" v-for="chat in group.items" :key="chat.id">
                <div 
                  class="submenu_item" 
                  :class="{ 'submenu_item_active': currentChatId === chat.id }"
                  @click="selectChat(chat.id)"
                >
                  <!-- 编辑模式 -->
                  <t-input
                    v-if="editingChatId === chat.id"
                    v-model="editingTitle"
                    size="small"
                    @blur="saveChatTitle(chat.id)"
                    @keyup.enter="saveChatTitle(chat.id)"
                    @keyup.escape="cancelEdit"
                    @click.stop
                    autofocus
                    style="flex:1"
                  />
                  <!-- 显示模式 -->
                  <span v-else class="submenu_title">{{ chat.title || '新对话' }}</span>
                  <!-- 操作按钮（hover 显示） -->
                  <div v-if="editingChatId !== chat.id" class="submenu_actions" @click.stop>
                    <t-icon
                      name="edit-1"
                      size="16px"
                      class="submenu_action_icon"
                      @click="startEdit(chat)"
                      title="重命名"
                    />
                    <t-icon
                      name="delete"
                      size="16px"
                      class="submenu_action_icon submenu_delete_icon"
                      @click="deleteChatItem(chat.id)"
                      title="删除"
                    />
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 右侧内容区 -->
    <div class="main-content">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, provide, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getChats, createChat, updateChat, deleteChat } from '@/api'

const router = useRouter()
const route = useRoute()

// currentChatId 直接从路由参数读取，确保和路由完全同步
const currentChatId = computed(() => (route.params.id as string) || '')

// 对话列表（从后端加载）
const chatList = ref<any[]>([])

// 按时间分组
const groupedChats = computed(() => {
  const groups: { [key: string]: any[] } = {
    '今天': [],
    '近7天': [],
    '近30天': [],
    '更早': []
  }
  
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
  
  chatList.value.forEach(chat => {
    const chatDate = new Date(chat.created_at)
    if (chatDate >= today) {
      groups['今天'].push(chat)
    } else if (chatDate >= sevenDaysAgo) {
      groups['近7天'].push(chat)
    } else if (chatDate >= thirtyDaysAgo) {
      groups['近30天'].push(chat)
    } else {
      groups['更早'].push(chat)
    }
  })
  
  return Object.entries(groups)
    .filter(([_, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }))
})

const goTo = (path: string) => {
  // 点击"对话"菜单时，如果已在某个 chat 中，不要导航离开（防止丢失 session）
  if (path === '/chat' && currentChatId.value) return
  router.push(path)
}

const selectChat = (chatId: string) => {
  router.push(`/chat/${chatId}`)
}

const createNewChat = async () => {
  try {
    const res = await createChat('', '')
    await loadChats()
    router.push(`/chat/${res.data.id}`)
  } catch (err) {
    console.error('Failed to create chat:', err)
  }
}

const loadChats = async () => {
  try {
    const res = await getChats()
    chatList.value = res.data.chats || []
  } catch (err) {
    console.error('Failed to load chats:', err)
  }
}

// 对外提供共享状态
provide('chatList', chatList)
provide('currentChatId', currentChatId)
provide('loadChats', loadChats)
provide('setCurrentChatId', (id: string) => { router.push(`/chat/${id}`) })

// 编辑对话标题
const editingChatId = ref('')
const editingTitle = ref('')

const startEdit = (chat: any) => {
  editingChatId.value = chat.id
  editingTitle.value = chat.title || '新对话'
}

const cancelEdit = () => {
  editingChatId.value = ''
  editingTitle.value = ''
}

const saveChatTitle = async (chatId: string) => {
  if (!editingTitle.value.trim()) {
    cancelEdit()
    return
  }
  try {
    await updateChat(chatId, editingTitle.value.trim())
    const chat = chatList.value.find(c => c.id === chatId)
    if (chat) chat.title = editingTitle.value.trim()
  } catch (err) {
    console.error('Failed to update chat title:', err)
  }
  cancelEdit()
}

const deleteChatItem = async (chatId: string) => {
  try {
    await deleteChat(chatId)
    chatList.value = chatList.value.filter(c => c.id !== chatId)
    // 如果删的是当前对话，跳转到 /chat
    if (currentChatId.value === chatId) {
      router.push('/chat')
    }
  } catch (err) {
    console.error('Failed to delete chat:', err)
  }
}

onMounted(() => {
  loadChats()
})

const isActive = (path: string) => {
  return route.path.startsWith(path)
}
</script>

<style scoped>
.layout-container {
  display: flex;
  height: 100vh;
}

.aside_box {
  width: 260px;
  padding: 8px;
  background: #ffffff;
  box-sizing: border-box;
  height: 100vh;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e7e7e7;
  flex-shrink: 0;
}

.main-content {
  flex: 1;
  overflow: hidden;
}

.logo_row {
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 16px;
  flex-shrink: 0;
}

.logo_box {
  display: flex;
  align-items: center;
}

.logo_text {
  font-size: 18px;
  font-weight: 700;
  color: #0052d9;
  letter-spacing: 0.5px;
}

.logo_sub {
  font-size: 12px;
  font-weight: 500;
  color: #999999;
  margin-left: 8px;
  letter-spacing: 1px;
  text-transform: lowercase;
}

.menu_top {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.menu_box {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.menu_item {
  cursor: pointer;
  display: flex;
  align-items: center;
  height: 48px;
  padding: 13px 8px 13px 16px;
  box-sizing: border-box;
  margin-bottom: 4px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.menu_item:hover {
  background: #f5f5f5;
}

.menu_item_active {
  background: #e8f4ff !important;
}

.menu_item_active .menu_icon,
.menu_item_active .menu_title {
  color: #0052d9 !important;
}

.menu_item-box {
  display: flex;
  align-items: center;
  width: 100%;
}

.menu_icon {
  display: flex;
  margin-right: 10px;
  color: #666666;
}

.menu_title {
  color: #666666;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  overflow: hidden;
  white-space: nowrap;
  flex: 1;
}

.menu-create-hint {
  margin-left: auto;
  font-size: 16px;
  color: #0052d9;
  opacity: 0.7;
  cursor: pointer;
}

.menu_item:hover .menu-create-hint {
  opacity: 1;
}

.submenu {
  font-size: 14px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  margin-left: 4px;
}

.timeline_header {
  font-size: 12px;
  font-weight: 600;
  color: #999999;
  padding: 12px 18px 6px 18px;
  margin-top: 8px;
  line-height: 20px;
  user-select: none;
}

.timeline_header:first-child {
  margin-top: 4px;
}

.submenu_item_p {
  padding: 2px 0;
  box-sizing: border-box;
}

.submenu_item {
  cursor: pointer;
  display: flex;
  align-items: center;
  color: #666666;
  font-weight: 400;
  line-height: 22px;
  height: 36px;
  padding: 0 8px 0 14px;
  border-radius: 8px;
  transition: background-color 0.2s ease;
  position: relative;
}

.submenu_item:hover {
  background: #f5f5f5;
  color: #333333;
}

.submenu_item_active {
  background: #e8f4ff !important;
  color: #0052d9 !important;
}

.submenu_title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

/* 操作按钮区 --hover 才显示 */
.submenu_actions {
  display: none;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.submenu_item:hover .submenu_actions {
  display: flex;
}

.submenu_action_icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: #888;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.submenu_action_icon:hover {
  background: #e0e0e0;
  color: #333;
}

.submenu_delete_icon:hover {
  background: #ffe0e0 !important;
  color: #d54941 !important;
}
</style>
