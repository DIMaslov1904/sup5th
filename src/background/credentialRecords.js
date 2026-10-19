export const publicAccess = access => ({
    id: access.id, url: access.url, siteUrl: access.siteUrl, includeSubdomains: access.includeSubdomains !== false, name: access.name, login: access.login,
    hasLogin: Boolean(access.login), hasPassword: Boolean(access.password || access.hasPassword),
    hasFtp: Boolean(access.ftp?.url || access.hasFtp), ftpUrl: access.ftp?.url || access.ftpUrl || '',
    ftpHasLogin: Boolean(access.ftp?.login || access.ftpHasLogin), ftpHasPassword: Boolean(access.ftp?.password || access.ftpHasPassword)
})
export const publicService = ({ password, ...service }) => ({ ...service, hasLogin: Boolean(service.login), hasPassword: Boolean(password) })
export const accessSecret = ({ id, password, ftp }) => ({ id, password, ftp: ftp || null })
