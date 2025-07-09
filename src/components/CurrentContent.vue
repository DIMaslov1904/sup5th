<template>
  <div class="current-content">
    <header class="current-content__header">
      <a :href="getUrlAdminLogin(project.url, project.urlAdmin, project.cms)" target="_blank"
        class="current-content__cms" :title="project.cms">
        <img v-if="project.cms" :src="getIcon(project.cms === 'Своя' ? 'cms' : project.cms)" />
        <img v-else :src="getIcon('hosting')" />
      </a>
      <a class="current-content__name" :href="'https://' + project.url" target="_blank">
        <h1>{{ project.name }} ({{ project.url }})</h1>
      </a>
    </header>

    <Button v-if="project.git" size="l" :href="`https://${project.git}`" target="_blank"><img
        :src="getIcon('gitlab')" /></Button>
    <Button v-if="project.figma" size="l" :href="`https://${project.figma}`" target="_blank"><img
        :src="getIcon('figma')" /></Button>
    <Button v-if="project.manual" size="l" :href="`https://${project.manual}`" target="_blank">Инструкция
      <BookIcon />
    </Button>
    <Button v-if="project.addDocument" size="l" :href="`https://${project.addDocument}`"
      target="_blank">Доп.Документ</Button>
    <CopyText v-if="project.login" :text="project.login" />
    <CopyText v-if="project.password" :text="project.password" hide />
    <CopyAccess v-if="project.login" :project />
    <Button @click="pStore.remove(project.url)">Удалить проект</Button>
  </div>
</template>

<script setup lang="ts">
import { getIcon } from '@/utils/getFiles';
import { getUrlAdminLogin } from '@/utils/cms-api';
import Button from '@/components/ui/Button.vue';
import BookIcon from '@/components/icons/BookIcon.vue';
import CopyText from '@/components/ui/CopyText.vue';
import CopyAccess from '@/components/CopyAccess.vue';
import { useProjectsStore } from '@/stores';

const pStore = useProjectsStore()

defineProps<{
  project: Project;
}>();
</script>
<style lang="scss">
.current-content {
  position: relative;
  padding: 10px;
}

.current-content__header {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 10px;
  align-items: center;
}

.current-content__cms {
  aspect-ratio: 1;
  overflow: hidden;
  padding: 5px;
  background: #fff;
  border-radius: 16%;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform .3s;
  }

  &:hover {
    img {
      transform: scale(1.1);
    }
  }
}

.current-content__name {
  color: currentColor;
  text-decoration: none;
  word-break: break-all;
}
</style>
