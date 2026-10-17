import { computed, onMounted, onUnmounted, ref } from 'vue'
import { loadApiSettings } from './data/projectData.js'
import { resolveSetupStep } from '../utils/setupProgress.js'

export const useSetupState = () => {
    const settings = ref({}), ready = ref(false), error = ref('')
    let revision = 0, alive = true
    const load = async () => {
        const current = ++revision
        try {
            const saved = await loadApiSettings()
            if (!alive || current !== revision) return
            settings.value = saved; ready.value = true; error.value = ''
        } catch (reason) { if (alive && current === revision) error.value = reason.message }
    }
    const changed = (changes, area) => { if (area === 'local' && changes.apiSettings) load() }
    onMounted(() => { chrome.storage.onChanged.addListener(changed); load() })
    onUnmounted(() => { alive = false; revision++; chrome.storage.onChanged.removeListener(changed) })
    return { settings, ready, error, retry: load, step: computed(() => resolveSetupStep(settings.value)) }
}
