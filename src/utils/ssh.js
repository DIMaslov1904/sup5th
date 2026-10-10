export const getSshCommand = (login, host) => {
    if (!/^[a-zA-Z0-9_][a-zA-Z0-9._-]*$/.test(String(login || ''))) throw new Error('Некорректный SSH-логин')
    const raw = String(host || '').trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    let url
    try { url = new URL(`ssh://${raw}`) } catch { throw new Error('Некорректный SSH-host или порт') }
    if (!url.hostname || url.username || url.password || !/^[a-zA-Z0-9.\-:\[\]]+$/.test(url.hostname)) throw new Error('Некорректный SSH-host')
    return `ssh ${login}@${url.hostname}${url.port ? ` -p ${url.port}` : ''}`
}
