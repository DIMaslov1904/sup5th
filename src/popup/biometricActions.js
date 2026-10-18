import { isFirefox } from '../platform/extensionApi.js'
import { enableBiometricProtectionFlow, unlockWithBiometricFlow } from '../utils/biometricHello.js'
import { runBiometricPage } from '../utils/biometricPage.js'
import { enableHelloProtection, unlockCredentialVaultWithHello } from './data/projectData.js'

export const enableCredentialProtection = async (options = {}) => {
    if (isFirefox) return runBiometricPage('enable', options)
    return enableHelloProtection(await enableBiometricProtectionFlow())
}
export const unlockCredentialProtection = async status => {
    if (isFirefox) return runBiometricPage('unlock')
    const { key } = await unlockWithBiometricFlow(status)
    return unlockCredentialVaultWithHello(key)
}
