export const VAULT_SESSION_LIFETIME = 10 * 60000
export const VAULT_SESSION_ALARM = 'credential-vault-expiry'

export const createVaultSession = (key, timeLimited, now = Date.now()) => (
    timeLimited ? { key, expiresAt: now + VAULT_SESSION_LIFETIME } : { key }
)

// Check at every use: alarms may be delayed while Safari or the Mac is asleep.
export const isVaultSessionValid = (session, timeLimited, now = Date.now()) => Boolean(
    session?.key && (!timeLimited || (Number.isFinite(session.expiresAt) && session.expiresAt > now))
)
