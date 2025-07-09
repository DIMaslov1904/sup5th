<template>
  <div class="search">
    <Input v-model="model" class="search__input" placeholder="Поиск..." />
    <Button v-if="model" @click="model = ''" class="search__reset">
      <CloseIcon />
    </Button>
  </div>
</template>

<script setup lang="ts">
import Input from "@/components/ui/Input.vue";
import Button from "@/components/ui/Button.vue";
import CloseIcon from "../icons/CloseIcon.vue";

const model = defineModel();
</script>

<style lang="scss">
.search {
  position: relative;

  &__input {
    width: 100%;
    padding-right: 32px;
  }

  &__reset {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
  }
}
</style>
