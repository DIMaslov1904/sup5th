import { onBeforeUnmount, onMounted, ref } from 'vue'

export const useColorScheme = () => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const theme = ref(media.matches ? 'dark' : 'light')
    const changed = event => { theme.value = event.matches ? 'dark' : 'light' }
    onMounted(() => media.addEventListener('change', changed))
    onBeforeUnmount(() => media.removeEventListener('change', changed))
    return theme
}
