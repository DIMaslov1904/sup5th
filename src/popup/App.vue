<template>
  <div class="popup-container">
    <transition name="fade">
      <Welcome v-if="store.state.init" @setIsFixHeight="setIsFixHeight" />
    </transition>
    <PopupContent v-if="!isLoading" :fixHeight>
      <Current v-if="store.state.page === 'currentSite'" />
      <Services v-else-if="store.state.page === 'services'" />
      <ProjectList v-else-if="store.state.page === 'projectList'" @setIsFixHeight="setIsFixHeight" />
      <Settings v-else-if="store.state.page === 'settings'" />
      <Audit v-else-if="store.state.page === 'audit'" />
      <Notification v-else-if="store.state.page === 'notification'" />
    </PopupContent>
    <PopupNav>
      <PopupNavItem title="Текущий проект" @click="store.setPage('currentSite')"
        :active="store.state.page === 'currentSite'">
        <LocationIcon />
      </PopupNavItem>
      <PopupNavItem title="Полезные сервисы" @click="store.setPage('services')"
        :active="store.state.page === 'services'">
        <LayerIcon />
      </PopupNavItem>
      <PopupNavItem title="Список проектов" @click="store.setPage('projectList')"
        :active="store.state.page === 'projectList'">
        <FolderIcon v-if="projectsStore.state.projects.length > 0" />
        <FolderIconEmpty v-else />
      </PopupNavItem>
      <PopupNavItem title="Обновить проекты и доступы" @click="projectsStore.updateAll" :active="projectsStore.state.isLoading || projectsStore.state.isLoadingAccess
        " :disabled="projectsStore.state.isLoading || projectsStore.state.isLoadingAccess
          ">
        <CloudChangeAnimIcon v-if="
          projectsStore.state.isLoading || projectsStore.state.isLoadingAccess
        " />
        <CloudChangeIcon v-else />
      </PopupNavItem>
      <PopupNavItem title="Аудит сайта" @click="store.setPage('audit')" :active="store.state.page === 'audit'">
        <ColorSwatchIcon />
      </PopupNavItem>
      <PopupNavItem title="Уведомления" @click="store.setPage('notification')"
        :active="store.state.page === 'notification'" :count="noticeStore.state.length">
        <InfoCircleIcon />
      </PopupNavItem>
      <PopupNavItem title="Sup 5th v 3.0.0" @click="store.setPage('settings')"
        :active="store.state.page === 'settings'">
        <ConvertIcon />
      </PopupNavItem>
    </PopupNav>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  useMainStore,
  useProjectsStore,
  useNoticeStore,
  useSelectProjectStore,
} from "@/stores";
import CloudChangeIcon from "@/components/icons/CloudChangeIcon.vue";
import ConvertIcon from "@/components/icons/ConvertIcon.vue";
import FolderIcon from "@/components/icons/FolderIcon.vue";
import FolderIconEmpty from "@/components/icons/FolderIconEmpty.vue";
import LayerIcon from "@/components/icons/LayerIcon.vue";
import LocationIcon from "@/components/icons/LocationIcon.vue";
import PopupContent from "@/components/PopupContent.vue";
import PopupNav from "@/components/PopupNav.vue";
import PopupNavItem from "@/components/PopupNavItem.vue";
import Current from "@/pages/Current.vue";
import Services from "@/pages/Services.vue";
import ProjectList from "@/pages/ProjectList.vue";
import Welcome from "@/pages/Welcome.vue";
import InfoCircleIcon from "@/components/icons/InfoCircleIcon.vue";
import ColorSwatchIcon from "@/components/icons/ColorSwatchIcon.vue";
import Notification from "@/pages/Notification.vue";
import Audit from "@/pages/Audit.vue";
import Settings from "@/pages/Settings.vue";
import CloudChangeAnimIcon from "@/components/icons/CloudChangeAnimIcon.vue";

const isLoading = ref(true);
const fixHeight = ref(true);

const store = useMainStore();
const projectsStore = useProjectsStore();
const noticeStore = useNoticeStore();
const selectProjectState = useSelectProjectStore();

const setIsFixHeight = (v: boolean) => (fixHeight.value = v);

onMounted(async () => {
  await store.loadFromStorage();
  await projectsStore.loadFromStorage();
  await noticeStore.loadFromStorage();
  await selectProjectState.loadFromStorage();
  isLoading.value = false;
});
</script>
