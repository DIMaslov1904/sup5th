<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { POPUP_PORT_NAME } from '../utils/popupState.js'
import Layout from './components/Layout.vue'
import UnlockModal from './components/UnlockModal.vue'
import Site from './views/Site.vue'
import Projects from './views/Projects.vue'
import Settings from './views/Settings.vue'

const view = ref('site')
const stateReady = ref(false)
const selectedProjectUrl = ref('')
const selectedServiceId = ref('')
let statePort = null
let heartbeat

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
    label: 'Настройки',
    name: 'settings'
  }
]

const saveUiState = () => {
  if (!stateReady.value || !statePort) return
  statePort.postMessage({ type: 'state', state: { view: view.value, projectUrl: selectedProjectUrl.value, serviceId: selectedServiceId.value } })
}

watch(view, (value) => {
  if (value !== 'projects') { selectedProjectUrl.value = ''; selectedServiceId.value = '' }
}, { flush: 'sync' })
watch([view, selectedProjectUrl, selectedServiceId], saveUiState, { flush: 'sync' })

onMounted(() => {
  statePort = chrome.runtime.connect({ name: POPUP_PORT_NAME })
  statePort.onMessage.addListener((message) => {
    if (message?.type !== 'restore') return
    view.value = message.state.view
    selectedProjectUrl.value = message.state.projectUrl
    selectedServiceId.value = message.state.serviceId || ''
    stateReady.value = true
    saveUiState()
  })
  statePort.onDisconnect.addListener(() => {
    clearInterval(heartbeat)
    statePort = null
    // Read lastError if the extension is reloaded while the popup is open.
    if (chrome.runtime.lastError) console.warn('[popup] session disconnected', chrome.runtime.lastError.message)
    stateReady.value = true
  })
  // MV3 workers need messages, not just an open port, to stay alive.
  heartbeat = setInterval(() => statePort?.postMessage({ type: 'ping' }), 20000)
})

onUnmounted(() => {
  clearInterval(heartbeat)
  statePort?.disconnect()
})
</script>
<template>
  <Layout v-if="stateReady" v-model="view" :menuList="viewList">
    <Site v-if="view === 'site'" />
    <Projects v-if="view === 'projects'" v-model:selected-project-url="selectedProjectUrl" v-model:selected-service-id="selectedServiceId" />
    <Settings v-if="view === 'settings'" />
  </Layout>
  <UnlockModal />
</template>
