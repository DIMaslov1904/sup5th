<script setup>
import { defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { POPUP_PORT_NAME } from '../utils/popupState.js'
import { createSeoSessionClient } from './seoSessionClient.js'
import Layout from './components/Layout.vue'
import UnlockModal from './components/UnlockModal.vue'
import TicketModal from './components/TicketModal.vue'
import Site from './views/Site.vue'
import Projects from './views/Projects.vue'
import Settings from './views/Settings.vue'
import { connectBackgroundState } from './backgroundState.js'
import Preloader from './components/ui/Preloader.vue'
import NotificationHost from './components/ui/NotificationHost.vue'
import Notification from './components/ui/Notification.vue'
import Button from './components/ui/Button.vue'
import { useSetupState } from './setupState.js'
const Welcome = defineAsyncComponent(() => import('./views/Welcome.vue'))
const { settings: setupSettings, ready: setupReady, step: setupStep, error: setupError, retry: retrySetup } = useSetupState()
const Tools = defineAsyncComponent(() => import('./views/Tools.vue'))
const SeoPanel = defineAsyncComponent(() => import('./components/SeoPanel.vue'))
const seoTab = ref(null), seoTabReady = ref(false)
const seoSession = ref(null)
let tabRevision = 0

const view = ref('site')
const stateReady = ref(false)
const selectedProjectUrl = ref('')
const selectedServiceId = ref('')
const search = ref('')
const ticketOpen = ref(false)
let statePort = null
let heartbeat
let disconnectState

const openCatalogue = () => {
  selectedProjectUrl.value = ''
  selectedServiceId.value = ''
  view.value = 'projects'
}
watch(search, openCatalogue)

const saveUiState = () => {
  if (!stateReady.value || !statePort) return
  statePort.postMessage({ type: 'state', state: { view: view.value, projectUrl: selectedProjectUrl.value, serviceId: selectedServiceId.value, seoTabId: seoTab.value?.id, seoUrl: seoTab.value?.url } })
}

watch(view, (value) => {
  if (value !== 'projects') { selectedProjectUrl.value = ''; selectedServiceId.value = '' }
  const revision = ++tabRevision
  seoTabReady.value = false
  seoTab.value = null
  if (value === 'seo') chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (revision !== tabRevision) return
    seoTab.value = tab || null
    seoTabReady.value = true
  })
}, { flush: 'sync' })
watch([view, selectedProjectUrl, selectedServiceId, seoTab], saveUiState, { flush: 'sync' })

onMounted(() => {
  disconnectState = connectBackgroundState()
  statePort = chrome.runtime.connect({ name: POPUP_PORT_NAME })
  seoSession.value = createSeoSessionClient(statePort)
  statePort.onMessage.addListener(async (message) => {
    if (message?.type !== 'restore') return
    let restoredView = message.state.view
    if (restoredView === 'seo') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.id !== message.state.seoTabId || tab?.url !== message.state.seoUrl) restoredView = 'site'
    }
    view.value = restoredView
    selectedProjectUrl.value = message.state.projectUrl
    selectedServiceId.value = message.state.serviceId || ''
    stateReady.value = true
    saveUiState()
  })
  statePort.onDisconnect.addListener(() => {
    clearInterval(heartbeat)
    seoSession.value?.dispose()
    statePort = null
    // Read lastError if the extension is reloaded while the popup is open.
    if (chrome.runtime.lastError) console.warn('[popup] session disconnected', chrome.runtime.lastError.message)
    stateReady.value = true
  })
  // MV3 workers need messages, not just an open port, to stay alive.
  heartbeat = setInterval(() => statePort?.postMessage({ type: 'ping' }), 20000)
})

onUnmounted(() => {
  disconnectState?.()
  clearInterval(heartbeat)
  seoSession.value?.dispose()
  statePort?.disconnect()
})
</script>
<template>
  <Welcome v-if="setupReady && setupStep !== 'done'" :step="setupStep" :settings="setupSettings" @completed="openCatalogue" />
  <Layout v-else-if="stateReady && setupReady" v-model="view" v-model:search="search" @search="openCatalogue" @ticket="ticketOpen = true">
    <Site v-if="view === 'site'" />
    <section v-if="view === 'seo'" class="px-3"><SeoPanel v-if="seoTabReady" :tab="seoTab" :session="seoSession" auto-scan /></section>
    <Projects v-if="view === 'projects'" v-model:search="search" v-model:selected-project-url="selectedProjectUrl" v-model:selected-service-id="selectedServiceId" />
    <Settings v-if="view === 'settings'" />
    <Tools v-if="view === 'tools'" />
  </Layout>
  <div v-else><Preloader label="Загрузка расширения…" /><Button v-if="setupError" class="mx-4" @click="retrySetup">Повторить загрузку</Button></div>
  <Notification v-if="setupError" :text="setupError" />
  <UnlockModal />
  <TicketModal v-model:open="ticketOpen" />
  <NotificationHost />
</template>
