import { extensionApi, isFirefox } from '../platform/extensionApi.js'
import { base64UrlToBytes, bytesToBase64Url, getBiometricPlatform, randomBytes } from './biometricHello.js'

const readOutput = credential => {
    const prf = credential.getClientExtensionResults?.().prf
    const value = prf?.results?.first
    const bytes = value ? new Uint8Array(value) : null
    return { secret: bytes?.length === 32 ? bytes : null,
        summary: { prfPresent: Boolean(prf), prfEnabled: prf?.enabled ?? null, prfBytes: bytes?.length ?? 0 } }
}
const sameBytes = (first, second) => Boolean(first && second && first.length === second.length && first.every((value, i) => value === second[i]))
const authenticatorSummary = (credential, creation = false) => {
    const value = creation ? credential.response?.getAuthenticatorData?.() : credential.response?.authenticatorData
    const bytes = value ? new Uint8Array(value) : new Uint8Array()
    const flags = bytes.length >= 37 ? bytes[32] : null
    let aaguid = null
    if (creation && bytes.length >= 55 && (flags & 64)) {
        const hex = [...bytes.slice(37, 53)].map(value => value.toString(16).padStart(2, '0')).join('')
        aaguid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    }
    return { attachment: credential.authenticatorAttachment ?? null, userPresent: flags === null ? null : Boolean(flags & 1),
        userVerified: flags === null ? null : Boolean(flags & 4), backupEligible: flags === null ? null : Boolean(flags & 8),
        backedUp: flags === null ? null : Boolean(flags & 16), ...(creation ? { aaguid } : {}) }
}

const credentialBytes = credential => {
    const decoded = base64UrlToBytes(credential.id)
    if (credential.rawId && !sameBytes(decoded, new Uint8Array(credential.rawId))) throw new Error('credential-mismatch')
    return decoded
}
const requestContext = () => ({
    userActivation: navigator.userActivation?.isActive ?? null,
    focused: globalThis.document?.hasFocus() ?? null,
    visibility: globalThis.document?.visibilityState ?? null
})

// A session keeps one disposable credential and its salt in memory for explicit retries.
// Reports use an allowlist: no credential ID, salt, signature or PRF output.
export const createBiometricPrfProbe = () => {
    const report = { version: 2, result: 'not-run', environment: {
        userAgent: navigator.userAgent, platform: getBiometricPlatform(), originScheme: location.protocol
    }, registration: null, assertions: {}, outputsMatch: null, createMatches: null, repeatMatches: null }
    const salt = randomBytes(32)
    const rpId = extensionApi?.runtime?.id || location.hostname
    const rp = isFirefox ? {} : { rpId }
    let credential, created, createdAt
    const outputs = new Map()
    const getReport = () => structuredClone(report)
    const failure = (error, phase) => {
        report.result = error.name === 'AbortError' ? 'aborted' : error.name === 'NotAllowedError' ? 'not-allowed'
            : error.message === 'credential-mismatch' ? 'credential-mismatch' : 'request-error'
        report.failedPhase = phase; report.errorName = error.name || 'Error'
        return getReport()
    }
    const clearFailure = () => { delete report.failedPhase; delete report.errorName }
    const create = async ({ signal } = {}) => {
        // A new test key requires a new session; retries keep using this key.
        if (credential) throw new Error('test-key-already-created')
        try {
            signal?.throwIfAborted()
            credential = await navigator.credentials.create({ signal, publicKey: {
                rp: { ...(isFirefox ? {} : { id: rpId }), name: 'SUP 5th PRF test' },
                user: { id: randomBytes(16), name: `SUP 5th PRF test ${bytesToBase64Url(randomBytes(3))}`, displayName: 'SUP 5th PRF test' },
                challenge: randomBytes(32), timeout: 60000,
                pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
                authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', userVerification: 'required' },
                attestation: 'none', extensions: { prf: { eval: { first: salt } } }
            } })
            signal?.throwIfAborted()
            if (!credential) throw new DOMException('No credential', 'NotAllowedError')
            const bytes = credentialBytes(credential)
            created = readOutput(credential); createdAt = Date.now()
            const transports = (credential.response?.getTransports?.() || []).filter(value =>
                ['internal', 'hybrid', 'usb', 'nfc', 'ble', 'smart-card'].includes(value))
            report.registration = { ...created.summary, ...authenticatorSummary(credential, true), transports,
                credentialIdBytes: bytes.length, idMatchesRawId: credential.rawId ? true : null }
            clearFailure(); report.result = 'created'
            return getReport()
        } catch (error) { credential = null; return failure(error, 'create') }
    }
    const updateResult = (mode, label, secret) => {
        const previous = outputs.get(label)
        outputs.set(label, secret)
        const valid = [...outputs.values()].filter(Boolean)
        report.createMatches = created.secret && valid.length ? valid.every(value => sameBytes(created.secret, value)) : null
        report.outputsMatch = outputs.get('eval') && outputs.get('evalByCredential')
            ? sameBytes(outputs.get('eval'), outputs.get('evalByCredential')) : null
        if (label === 'repeat' || previous) report.repeatMatches = sameBytes(previous || valid[0], secret)
        const malformed = Object.values(report.assertions).some(value => value.prfBytes > 0 && value.prfBytes !== 32)
        if (malformed || report.createMatches === false || report.outputsMatch === false || report.repeatMatches === false ||
            (valid.length > 1 && !valid.every(value => sameBytes(valid[0], value)))) report.result = 'inconsistent'
        else if (!secret) report.result = 'no-prf'
        else if (report.outputsMatch) report.result = 'both-working'
        else report.result = mode === 'discoverable' ? 'discovery-working' : 'request-working'
    }
    const request = async (mode, { signal, label = mode } = {}) => {
        if (!credential || !['evalByCredential', 'eval', 'discoverable'].includes(mode)) throw new Error('invalid-probe-request')
        const context = { ...requestContext(), millisecondsSinceCreate: Math.max(0, Date.now() - createdAt) }
        try {
            signal?.throwIfAborted()
            const assertion = await navigator.credentials.get({ signal, publicKey: {
                ...rp, challenge: randomBytes(32), timeout: 60000, userVerification: 'required',
                allowCredentials: mode === 'discoverable' ? []
                    : [{ type: 'public-key', id: credentialBytes(credential), transports: ['internal'] }],
                extensions: { prf: mode === 'evalByCredential' ? { evalByCredential: { [credential.id]: { first: salt } } }
                    : { eval: { first: salt } } }
            } })
            signal?.throwIfAborted()
            if (!assertion) throw new DOMException('No assertion', 'NotAllowedError')
            if (assertion.id !== credential.id || !sameBytes(credentialBytes(assertion), credentialBytes(credential))) throw new Error('credential-mismatch')
            const output = readOutput(assertion)
            const authenticator = authenticatorSummary(assertion)
            const secret = authenticator.userPresent && authenticator.userVerified ? output.secret : null
            report.assertions[label] = { ...output.summary, ...authenticator, ...context, usablePrf: Boolean(secret) }
            clearFailure(); updateResult(mode, label, secret)
            return getReport()
        } catch (error) {
            outputs.delete(label)
            report.assertions[label] = { ...context, errorName: error.name || 'Error' }
            return failure(error, label)
        }
    }
    return { create, request, getReport }
}

// Automated harness for protocol tests. The diagnostics UI calls each phase separately.
export const runBiometricPrfProbe = async ({ signal, onStep = () => {} } = {}) => {
    const probe = createBiometricPrfProbe()
    onStep('create')
    let report = await probe.create({ signal })
    if (!report.registration) return report
    for (const mode of ['evalByCredential', 'eval']) {
        onStep(mode); report = await probe.request(mode, { signal })
        if (report.failedPhase) return report
    }
    if (report.result === 'both-working' || report.result === 'inconsistent') return report
    const mode = ['eval', 'evalByCredential'].find(value => report.assertions[value]?.usablePrf)
    if (!mode) return report
    onStep('repeat'); report = await probe.request(mode, { signal, label: 'repeat' })
    if (!report.failedPhase && report.result !== 'inconsistent') report.result = report.repeatMatches ? `${mode}-only` : 'inconsistent'
    return report
}
