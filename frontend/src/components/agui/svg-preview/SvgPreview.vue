<template>
  <div class="svg-preview">
    <!-- 大图预览：Swiper 翻页 + 分页器（当前/总数） -->
    <t-swiper
      v-if="pages.length"
      :current="current"
      :autoplay="false"
      :navigation="{ type: 'fraction', showSlideBtn: 'always' }"
      :loop="false"
      :height="480"
      class="svg-swiper"
      @change="onSwiperChange"
    >
      <t-swiper-item v-for="p in pages" :key="p.page">
        <div class="svg-stage">
          <div class="svg-box" v-html="p.svg"></div>
        </div>
      </t-swiper-item>
    </t-swiper>

    <!-- 底部缩略图行 -->
    <div v-if="pages.length > 1" class="svg-thumbs">
      <div
        v-for="(p, idx) in pages"
        :key="'thumb-' + p.page"
        class="svg-thumb"
        :class="{ active: idx === current }"
        @click="goTo(idx)"
      >
        <div class="svg-thumb-box" v-html="p.svg"></div>
        <span class="svg-thumb-no">{{ p.page }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { SvgPage } from './types'

const props = defineProps<{ pages: SvgPage[] }>()

const current = ref(0)

// 新增页时自动跳到最新一张
watch(
  () => props.pages.length,
  (len, oldLen) => {
    if (len > (oldLen || 0)) {
      current.value = len - 1
    }
  },
)

function onSwiperChange(index: number) {
  current.value = index
}

function goTo(idx: number) {
  current.value = idx
}
</script>

<style scoped>
.svg-preview {
  margin: 8px 0;
  border: 1px solid #e7e7e7;
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
}
.svg-swiper {
  width: 100%;
  background: #f6f8fa;
}
.svg-swiper :deep(.t-swiper__container),
.svg-swiper :deep(.t-swiper__content),
.svg-swiper :deep(.t-swiper__content > ul),
.svg-swiper :deep(.t-swiper__item) {
  height: 100%;
}
.svg-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: #f6f8fa;
}
.svg-box {
  max-width: 100%;
  max-height: 100%;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.svg-box :deep(svg) {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: 100%;
  display: block;
}
.svg-thumbs {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  overflow-x: auto;
  border-top: 1px solid #eee;
  background: #fafbfc;
}
.svg-thumb {
  position: relative;
  flex-shrink: 0;
  width: 88px;
  aspect-ratio: 16 / 9;
  border: 2px solid transparent;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  background: #fff;
  transition: border-color .15s;
}
.svg-thumb:hover {
  border-color: #b5c7ee;
}
.svg-thumb.active {
  border-color: #0052d9;
}
.svg-thumb-box {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.svg-thumb-box :deep(svg) {
  max-width: 100%;
  max-height: 100%;
  height: auto;
  display: block;
}
.svg-thumb-no {
  position: absolute;
  right: 3px;
  bottom: 3px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 11px;
  line-height: 16px;
  text-align: center;
}
</style>
