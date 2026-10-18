// @ts-check
import { onBeforeUnmount, onMounted, ref } from 'vue'

export const useColorScheme = () => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const theme = ref(/** @type {'dark' | 'light'} */ (media.matches ? 'dark' : 'light'))
    /** @param {MediaQueryListEvent} event */
    const changed = event => { theme.value = event.matches ? 'dark' : 'light' }
    onMounted(() => media.addEventListener('change', changed))
    onBeforeUnmount(() => media.removeEventListener('change', changed))
    return theme
}
