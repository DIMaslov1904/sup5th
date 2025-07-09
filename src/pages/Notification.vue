<template>
  <div class="notice-container">
    <template v-if="noticeStore.state.length > 0">
      <ul class="notice-list">
        <li
          v-for="notice in noticeStore.state"
          :key="notice.timestamp"
          class="notice-item"
          :class="`notice-item_${notice.type}`"
        >
          <span class="notice-time">{{ formateDateRu(notice.timestamp) }}</span>
          <Button
            class="notice-remove"
            @click="noticeStore.remove(notice.timestamp)"
          >
            <CloseIcon />
          </Button>
          <Content v-html="notice.text"></Content>
        </li>
      </ul>
      <Button class="notice-remove-all" @click="noticeStore.removeAll"
        >Очистить все</Button
      >
    </template>
    <p v-else class="notice-empty">Уведомлений нет</p>
  </div>
</template>

<script setup lang="ts">
import { useNoticeStore } from "@/stores";
import Button from "@/components/ui/Button.vue";
import CloseIcon from "@/components/icons/CloseIcon.vue";
import { formateDateRu } from "@/utils/date";
import Content from "@/components/Content.vue";

const noticeStore = useNoticeStore();
</script>

<style lang="scss">
.notice-container {
  position: relative;
  min-height: 100%;
  padding-bottom: 47px;
}

.notice-empty {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  text-align: center;
  font-size: 18px;
  width: 100%;
}

.notice-remove-all {
  position: fixed;
  bottom: 10px;
  right: 70px;
}

.notice-list {
  display: grid;
  gap: 10px;
  padding: 10px;
}

.notice-item {
  position: relative;
  padding: 10px 56px 34px 10px;
  border: 1px solid var(--color-input-border);
  border-radius: 4px;
  background-color: transparent;

  &_error {
    background-color: light-dark(#d6c2c2, #2e1f1f);
  }

  &_success {
    background-color: light-dark(#c2d6c2, #1f2e1f);
  }

  &_warning {
    background-color: light-dark(#d6d1c2, #2e2a1f);
  }

  &_info {
    background-color: transparent;
  }
}

.notice-time {
  position: absolute;
  bottom: 10px;
  right: 10px;
  font-size: 12px;
}

.notice-remove {
  position: absolute;
  top: 10px;
  right: 10px;
}
</style>
