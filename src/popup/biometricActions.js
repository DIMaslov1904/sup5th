import { isFirefox, isSafari } from '../platform/extensionApi.js'
import { enableBiometricProtectionFlow, getBiometricPlatform, unlockWithBiometricFlow } from '../utils/biometricHello.js'
import { runBiometricPage } from '../utils/biometricPage.js'
import { enableHelloProtection, unlockCredentialVaultWithHello } from './data/projectData.js'

export const enableCredentialProtection = async (options = {}) => {
    if (isFirefox || isSafari || getBiometricPlatform() === 'windows') return runBiometricPage('enable', options)
    return enableHelloProtection(await enableBiometricProtectionFlow())
}
export const unlockCredentialProtection = async status => {
    if (isFirefox || isSafari) return runBiometricPage('unlock')
    const { key } = await unlockWithBiometricFlow(status)
    return unlockCredentialVaultWithHello(key)
}
