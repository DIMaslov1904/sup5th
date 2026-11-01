import { ref } from 'vue'

// Shared busy/message/error state for credential cards: one action at a time,
// the menu closes before work starts and the result is shown through CredentialCard.
export const useCardAction = card => {
    const busy = ref(false), message = ref(''), error = ref(false)
    const run = async (action, success = '') => {
        if (busy.value) return
        card.value?.close()
        busy.value = true; message.value = ''; error.value = false
        try {
            await action()
            message.value = success
        } catch (reason) {
            error.value = true
            message.value = reason.message
        } finally {
            busy.value = false
        }
    }
    return { busy, message, error, run }
}
