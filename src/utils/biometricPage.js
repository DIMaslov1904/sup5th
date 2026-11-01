import { extensionApi } from '../platform/extensionApi.js'
import { callBackground } from './backgroundClient.js'

export const BIOMETRIC_ACTION_HANDLED = Symbol('biometric-action-handled')
export const biometricPageCall = (type, payload) => callBackground(`security:page:${type}`, payload, { fallbackError: 'Страница биометрии недоступна' })

// A closed toolbar popup must not cancel the operation owned by the new page.
export const runBiometricPage = async (mode, options = {}) => {
    const { id } = await biometricPageCall('open', { ...options, mode })
    return new Promise((resolve, reject) => {
        let finished = false
        const finish = error => {
            if (finished) return
            finished = true; clearTimeout(timer); extensionApi.storage.onChanged.removeListener(changed)
            error ? reject(error) : resolve(BIOMETRIC_ACTION_HANDLED)
        }
        const check = () => biometricPageCall('result', { id }).then(({ state }) => {
            if (state === 'done') finish()
            else if (state === 'failed') finish(new Error('Действие после разблокировки не выполнено. Повторите его в расширении.'))
            else if (['cancelled', 'expired'].includes(state)) finish(new Error(state === 'cancelled' ? 'Проверка устройства отменена' : 'Запрос биометрии истёк'))
        }).catch(finish)
        const changed = (changes, area) => { if (area === 'session' && changes.biometricPageRequests) check() }
        const timer = setTimeout(() => finish(new Error('Запрос биометрии истёк')), 5 * 60000)
        extensionApi.storage.onChanged.addListener(changed); check()
    })
}
