<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import Layout from './components/Layout.vue'
import Site from './views/Site.vue'
import Projects from './views/Projects.vue'
import Services from './views/Services.vue'
import Settings from './views/Settings.vue'

const view = ref('site')
const stateReady = ref(false)
let persistTimer

const viewList = [
  {
    label: 'Сайт',
    name: 'site'
  },
  {
    label: 'Проекты',
    name: 'projects'
  },
  {
    label: 'Сервисы',
    name: 'services'
  },
  {
    label: 'Настройки',
    name: 'settings'
  }
]

const saveUiState = () => {
  if (!stateReady.value) return
  clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    chrome.storage.local.set({ popupUiState: { view: view.value, scrollY: window.scrollY } })
  }, 120)
}

const flushUiState = () => {
  if (!stateReady.value) return
  clearTimeout(persistTimer)
  chrome.storage.local.set({ popupUiState: { view: view.value, scrollY: window.scrollY } })
}

watch(view, saveUiState)

onMounted(async () => {
  const result = await chrome.storage.local.get('popupUiState')
  const savedState = result.popupUiState
  if (['site', 'projects', 'services', 'settings'].includes(savedState?.view)) {
    view.value = savedState.view
  }
  await nextTick()
  window.scrollTo(0, savedState?.scrollY || 0)
  stateReady.value = true
  window.addEventListener('scroll', saveUiState, { passive: true })
  window.addEventListener('pagehide', flushUiState)
  window.addEventListener('beforeunload', flushUiState)
})

onUnmounted(() => {
  window.removeEventListener('scroll', saveUiState)
  window.removeEventListener('pagehide', flushUiState)
  window.removeEventListener('beforeunload', flushUiState)
  flushUiState()
})
</script>
<template>
  <Layout v-model="view" :menuList="viewList">
    <Site v-if="view === 'site'" />
    <Projects v-if="view === 'projects'" />
    <Services v-if="view === 'services'" />
    <Settings v-if="view === 'settings'" />
  </Layout>
</template>
