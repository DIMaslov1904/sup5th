export const RELEASES_URL = 'https://github.com/DIMaslov1904/sup5th/releases'
export const RELEASE_API = 'https://api.github.com/repos/DIMaslov1904/sup5th/releases/latest'

const versionParts = value => {
    if (typeof value !== 'string' || !/^(0|[1-9]\d*)(\.(0|[1-9]\d*)){0,3}$/.test(value)) throw new Error('Некорректная версия релиза')
    const parts = value.split('.').map(Number)
    if (parts.some(part => part > 65535)) throw new Error('Некорректная версия релиза')
    return [...parts, ...Array(4 - parts.length).fill(0)]
}

export const compareVersions = (left, right) => {
    const a = versionParts(left), b = versionParts(right)
    for (let index = 0; index < 4; index++) {
        if (a[index] !== b[index]) return Math.sign(a[index] - b[index])
    }
    return 0
}

export const readRelease = (release, browser) => {
    const version = release?.tag_name?.replace(/^v/, '')
    versionParts(version)
    if (release.tag_name !== `v${version}` || release.draft !== false || release.prerelease !== false || !Array.isArray(release.assets)
        || release.html_url !== `${RELEASES_URL}/tag/v${version}`) throw new Error('Некорректные данные стабильного релиза')
    const names = [`sup5th-chromium-v${version}.zip`, `sup5th-chrome-v${version}.zip`]
    const packages = release.assets.filter(asset => asset.state === 'uploaded' && asset.size > 0 && typeof asset.name === 'string'
        && (browser === 'firefox' ? asset.name.toLowerCase().endsWith('.xpi') : names.includes(asset.name)))
    if (browser === 'firefox' && packages.length > 1) throw new Error('В релизе несколько XPI. Оставьте один подписанный пакет Firefox.')
    const asset = browser === 'firefox' ? packages[0] : packages.find(asset => asset.name === names[0]) || packages[0]
    if (asset && (/[/\\?#]/.test(asset.name)
        || asset.browser_download_url !== `${RELEASES_URL}/download/v${version}/${encodeURIComponent(asset.name)}`)) {
        throw new Error('Некорректная ссылка на пакет обновления')
    }
    return { version, releaseUrl: release.html_url, downloadUrl: asset?.browser_download_url || '' }
}
