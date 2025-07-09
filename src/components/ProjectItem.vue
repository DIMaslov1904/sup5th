<template>
  <li class="project-item" tabindex="0" role="button" @click="$emit('setSite')">
    <header class="project-item__header">
      <h2 class="project-item__title">{{ project.name }}</h2>

      <Button size="l" :href="'https://' + project.url" target="_blank" @click.stop>
        {{ project.url }}
      </Button>

      <Button size="l" :href="getUrlAdminLogin(project.url, project.urlAdmin, project.cms)" target="_blank"
        title="Админ. раздел" @click.stop>
        <GlobalEditIcon />
      </Button>
    </header>
  </li>
</template>
<script setup lang="ts">
import { getUrlAdminLogin } from '@/utils/cms-api';
import Button from '@/components/ui/Button.vue';
import GlobalEditIcon from '@/components/icons/GlobalEditIcon.vue';

defineProps<{
  project: Project
}>()
defineEmits<{
  setSite: []
}>()

</script>

<style lang="scss">
.project-item {
  position: relative;
  background-color: var(--color-secondary);
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--color-secondaty-hover);
  box-shadow: 0 0 10px rgba(0 0 0 / .3);
  transition-property: box-shadow;
  transition-duration: .2s;
  overflow: hidden;
  height: 76px;
  cursor: pointer;


  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: linear-gradient(light-dark(#fff, #2e2f38), light-dark(#ffffff00, #2e2f3800));
    z-index: 1;
  }

  &:hover {
    box-shadow: 0 0 10px rgba(255 255 255 / .3);
  }
}

.project-item__bg {
  position: absolute;
  inset: 0;
  object-fit: cover;
}

.project-item__header {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 10px;
  margin-bottom: 10px;
}

.project-item__title {
  font-size: 18px;
  line-height: 18px;
  height: 36px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>