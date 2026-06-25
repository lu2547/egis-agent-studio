<script setup lang="ts">
import { ref, computed } from 'vue';

/** 大纲条目结构（与 outline_card.py payload 对齐） */
export interface OutlineItem {
  page?: string;
  type: string;
  title: string;
  subtitle?: string;
  bullets?: string[];
  visual?: string;
}

const props = defineProps<{
  outline: OutlineItem[];
  documentType?: string;
  confirmed?: boolean;
}>();

const emit = defineEmits<{
  (e: 'confirm', updatedOutline: OutlineItem[]): void;
}>();

/* ── 本地可编辑副本 ─────────────────────────── */
const items = ref<OutlineItem[]>(JSON.parse(JSON.stringify(props.outline || [])));
const editingIndex = ref<number | null>(null);
const dragIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);
const isConfirmed = ref(props.confirmed ?? false);

const itemCount = computed(() => items.value.length);

/* ── 行内编辑 ─────────────────────────────── */
const startEdit = (index: number) => {
  if (isConfirmed.value) return;
  editingIndex.value = index;
};

const updateField = (index: number, field: keyof OutlineItem, value: any) => {
  items.value[index] = { ...items.value[index], [field]: value };
};

const updateBullet = (index: number, bulletIndex: number, value: string) => {
  const bullets = [...(items.value[index].bullets || [])];
  bullets[bulletIndex] = value;
  items.value[index] = { ...items.value[index], bullets };
};

const addBullet = (index: number) => {
  const bullets = [...(items.value[index].bullets || []), '新要点'];
  items.value[index] = { ...items.value[index], bullets };
};

const removeBullet = (index: number, bulletIndex: number) => {
  const bullets = [...(items.value[index].bullets || [])];
  bullets.splice(bulletIndex, 1);
  items.value[index] = { ...items.value[index], bullets };
};

const finishEdit = () => {
  editingIndex.value = null;
};

/* ── 拖拽调序 ─────────────────────────────── */
const onDragStart = (index: number) => {
  if (isConfirmed.value) return;
  dragIndex.value = index;
};

const onDragOver = (e: DragEvent, index: number) => {
  e.preventDefault();
  dragOverIndex.value = index;
};

const onDrop = (index: number) => {
  if (dragIndex.value === null || dragIndex.value === index) {
    dragIndex.value = null;
    dragOverIndex.value = null;
    return;
  }
  const list = [...items.value];
  const [moved] = list.splice(dragIndex.value, 1);
  list.splice(index, 0, moved);
  items.value = list;
  dragIndex.value = null;
  dragOverIndex.value = null;
};

const onDragEnd = () => {
  dragIndex.value = null;
  dragOverIndex.value = null;
};

/* ── 删除项 ─────────────────────────────── */
const removeItem = (index: number) => {
  if (isConfirmed.value) return;
  items.value.splice(index, 1);
};

/* ── 确认提交 ─────────────────────────────── */
const confirm = () => {
  isConfirmed.value = true;
  editingIndex.value = null;
  emit('confirm', JSON.parse(JSON.stringify(items.value)));
};

/* ── 类型标签 ──────────────────────────────── */
const typeLabel = (type: string) => {
  const map: Record<string, string> = {
    cover: '封面', toc: '目录', section: '章节',
    content: '内容', transition: '过渡', ending: '结尾',
    heading: '标题', subsection: '小节',
  };
  return map[type] || type;
};

const typeColor = (_type: string) => '#426cff';
</script>

<template>
  <div class="outline-card">
    <header class="outline-header">
      <div class="header-left">
        <strong>内容大纲</strong>
        <em>{{ documentType === 'word' ? 'Word' : 'PPT' }} · 共 {{ itemCount }} 项</em>
      </div>
      <button v-if="!isConfirmed" class="confirm-btn" type="button" @click="confirm">
        <span class="btn-icon">✓</span>
        确认大纲
      </button>
      <span v-else class="confirmed-badge">已确认</span>
    </header>

    <div class="outline-list">
      <div
        v-for="(item, index) in items"
        :key="index"
        :class="[
          'outline-item',
          { dragging: dragIndex === index, 'drag-over': dragOverIndex === index, editing: editingIndex === index, confirmed: isConfirmed }
        ]"
        draggable="true"
        @dragstart="onDragStart(index)"
        @dragover="onDragOver($event, index)"
        @drop="onDrop(index)"
        @dragend="onDragEnd"
      >
        <!-- 左侧页码/类型标签 -->
        <div class="item-sidebar">
          <span class="page-badge" :style="{ background: typeColor(item.type) }">
            {{ item.page || `P${index + 1}` }}
          </span>
          <span class="type-tag" :style="{ color: typeColor(item.type) }">
            {{ typeLabel(item.type) }}
          </span>
        </div>

        <!-- 拖拽手柄 -->
        <div v-if="!isConfirmed" class="drag-handle" title="拖拽调序">⠿</div>

        <!-- 右侧内容区 -->
        <div class="item-content" @dblclick="startEdit(index)">
          <template v-if="editingIndex === index">
            <input
              class="edit-input title-input"
              :value="item.title"
              @input="updateField(index, 'title', ($event.target as HTMLInputElement).value)"
              placeholder="标题"
            />
            <input
              v-if="item.subtitle !== undefined"
              class="edit-input subtitle-input"
              :value="item.subtitle"
              @input="updateField(index, 'subtitle', ($event.target as HTMLInputElement).value)"
              placeholder="副标题"
            />
            <div class="edit-bullets">
              <div v-for="(_, bIdx) in item.bullets || []" :key="bIdx" class="bullet-edit-row">
                <input
                  class="edit-input bullet-input"
                  :value="(item.bullets || [])[bIdx]"
                  @input="updateBullet(index, bIdx, ($event.target as HTMLInputElement).value)"
                  :placeholder="`要点 ${bIdx + 1}`"
                />
                <button class="bullet-remove" type="button" @click="removeBullet(index, bIdx)">×</button>
              </div>
              <button class="add-bullet" type="button" @click="addBullet(index)">+ 添加要点</button>
            </div>
            <button class="edit-done" type="button" @click="finishEdit">完成</button>
          </template>
          <template v-else>
            <div class="item-title">{{ item.title }}</div>
            <div v-if="item.subtitle" class="item-subtitle">{{ item.subtitle }}</div>
            <ul v-if="item.bullets?.length" class="item-bullets">
              <li v-for="(b, bIdx) in item.bullets" :key="bIdx">{{ b }}</li>
            </ul>
          </template>
        </div>

        <!-- 操作按钮 -->
        <div v-if="!isConfirmed" class="item-actions">
          <button class="action-btn" type="button" title="编辑" @click="startEdit(index)">✎</button>
          <button class="action-btn danger" type="button" title="删除" @click="removeItem(index)">×</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.outline-card {
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #e4e9f2;
  box-shadow: 0 8px 20px rgba(20, 34, 70, 0.06);
  overflow: hidden;
}

.outline-header {
  padding: 12px 16px;
  border-bottom: 1px solid #eef1f6;
  background: linear-gradient(135deg, #f8faff, #f5f2ff);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-left strong {
  color: #1e2432;
  font-size: 15px;
  font-weight: 900;
}

.header-left em {
  color: #7b8493;
  font-size: 12px;
  font-style: normal;
}

.confirm-btn {
  height: 30px;
  padding: 0 14px;
  border: 0;
  border-radius: 6px;
  color: #ffffff;
  background: linear-gradient(135deg, #3f7cff, #7158ff);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s ease;
}

.confirm-btn:hover {
  filter: brightness(1.05);
  transform: translateY(-1px);
}

.btn-icon { font-size: 13px; line-height: 1; }

.confirmed-badge {
  height: 26px;
  padding: 0 12px;
  border-radius: 13px;
  color: #40aa68;
  background: #eafaf0;
  font-size: 12px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
}

.outline-list {
  padding: 8px;
  display: grid;
  gap: 4px;
  max-height: 520px;
  overflow-y: auto;
}

.outline-item {
  display: grid;
  grid-template-columns: 60px 20px 1fr auto;
  gap: 8px;
  align-items: start;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: #fafbfe;
  transition: all 0.18s ease;
}

.outline-item:hover {
  background: #f3f7ff;
  border-color: #e4e9f2;
}

.outline-item.dragging {
  opacity: 0.4;
}

.outline-item.drag-over {
  border-color: #426cff;
  background: #eef3ff;
}

.outline-item.editing {
  border-color: #426cff;
  background: #ffffff;
  grid-template-columns: 60px 1fr auto;
}

.outline-item.confirmed {
  grid-template-columns: 60px 1fr;
}

.outline-item.editing .drag-handle {
  display: none;
}

.item-sidebar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.page-badge {
  min-width: 32px;
  height: 22px;
  padding: 0 6px;
  border-radius: 5px;
  color: #ffffff;
  font-size: 11px;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.type-tag {
  font-size: 10px;
  font-weight: 800;
}

.drag-handle {
  cursor: grab;
  color: #c0c6d2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 2px;
  font-size: 16px;
  user-select: none;
}

.drag-handle:active {
  cursor: grabbing;
}

.item-content {
  min-width: 0;
}

.item-title {
  color: #1e2432;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.4;
}

.item-subtitle {
  color: #6d7482;
  font-size: 12px;
  margin-top: 2px;
}

.item-bullets {
  margin: 4px 0 0;
  padding: 0 0 0 16px;
  list-style: none;
}

.item-bullets li {
  position: relative;
  color: #5a6270;
  font-size: 12px;
  line-height: 1.6;
}

.item-bullets li::before {
  content: '';
  position: absolute;
  left: -10px;
  top: 8px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #b0b8c8;
}

.edit-input {
  width: 100%;
  border: 1px solid #d4dae6;
  border-radius: 5px;
  padding: 4px 8px;
  color: #1e2432;
  font-size: 13px;
  background: #fafbfe;
  outline: none;
  transition: border-color 0.18s ease;
}

.edit-input:focus {
  border-color: #426cff;
  background: #ffffff;
}

.title-input {
  font-weight: 800;
  font-size: 14px;
}

.subtitle-input {
  margin-top: 4px;
  font-size: 12px;
  color: #6d7482;
}

.edit-bullets {
  margin-top: 6px;
  display: grid;
  gap: 4px;
}

.bullet-edit-row {
  display: grid;
  grid-template-columns: 1fr 24px;
  gap: 4px;
  align-items: center;
}

.bullet-input {
  font-size: 12px;
}

.bullet-remove {
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 4px;
  color: #ff5c86;
  background: #fff0f4;
  font-size: 14px;
  cursor: pointer;
  display: grid;
  place-items: center;
}

.add-bullet {
  height: 26px;
  border: 1px dashed #c0c6d2;
  border-radius: 5px;
  color: #7b8493;
  background: transparent;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.add-bullet:hover {
  border-color: #426cff;
  color: #426cff;
}

.edit-done {
  margin-top: 6px;
  height: 26px;
  padding: 0 14px;
  border: 0;
  border-radius: 5px;
  color: #ffffff;
  background: #426cff;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.item-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 2px;
}

.action-btn {
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 5px;
  color: #9298a4;
  background: transparent;
  display: grid;
  place-items: center;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  transition: all 0.18s ease;
}

.action-btn:hover {
  color: #426cff;
  background: #eef3ff;
}

.action-btn.danger:hover {
  color: #ff5c86;
  background: #fff0f4;
}
</style>
