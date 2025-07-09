<template>
  <span class="copy-text" :class="{ 'copy-text_hide': hide, 'copy-text_inline': inline }">
    {{ isHide ? "******" : text }}
    <Button v-if="hide" @click="isHide = !isHide" class="copy-text__hide">
      <EyeIcon v-if="isHide" />
      <EyeSlashIcon v-else />
    </Button>
    <Button @click="copy" :disabledd="isCopy" class="copy-text__copy">
      <ClipboardTickIcon v-if="isCopy" />
      <ClipboardTextIcon v-else />
    </Button>
  </span>
</template>

<script setup lang="ts">
import { ref } from "vue";
import ClipboardTextIcon from "@/components/icons/ClipboardTextIcon.vue";
import ClipboardTickIcon from "@/components/icons/ClipboardTickIcon.vue";
import EyeIcon from "@/components/icons/EyeIcon.vue";
import EyeSlashIcon from "@/components/icons/EyeSlashIcon.vue";
import Button from "@/components/ui/Button.vue";

const props = defineProps<{
  text: string;
  hide?: boolean;
  inline?: boolean;
}>();

const isCopy = ref(false);
const isHide = ref(props.hide);

const copy = () => {
  navigator.clipboard.writeText(props.text).then(() => {
    isCopy.value = true;
    setTimeout(() => (isCopy.value = false), 2000);
  });
};
</script>

<style lang="scss">
.copy-text {
  position: relative;
  display: inline-flex;
  padding: 0 50px 0 10px;
  align-items: center;
  border-radius: 9px;

  &_hide {
    padding-right: 100px;
  }

  &:not(.copy-text_inline) {
    border: 1px solid var(--color-input-border);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    -webkit-box-orient: vertical;
    padding-top: 5px;
    padding-bottom: 5px;
  }
}

.copy-text__hide,
.copy-text__copy {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
}

.copy-text__copy {
  right: 0;
}

.copy-text__hide {
  right: 36px;
}
</style>
