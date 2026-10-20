import { extensionApi, isFirefox } from '../platform/extensionApi.js'
import { storageGet, storageSet, mutateStorage } from './storageRepository.js'
import { createUpdateChecker, UPDATE_ALARM, UPDATE_STATE_KEY } from '../updates/checker.js'

export const updateChecker = createUpdateChecker({
    browser: isFirefox ? 'firefox' : 'chromium',
    currentVersion: extensionApi.runtime.getManifest().version,
    read: () => storageGet(UPDATE_STATE_KEY),
    write: value => mutateStorage(() => storageSet(UPDATE_STATE_KEY, value)),
    alarms: extensionApi.alarms
})

export const registerExtensionUpdates = ready => {
    const start = () => ready.then(() => updateChecker.start()).catch(error => console.error('[updates]', error))
    extensionApi.runtime.onStartup.addListener(start)
    extensionApi.runtime.onInstalled.addListener(start)
    extensionApi.alarms.onAlarm.addListener(alarm => { if (alarm.name === UPDATE_ALARM) start() })
    start()
}
