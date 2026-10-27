import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const tag = process.env.RELEASE_TAG
if (!/^v[0-9]+(?:\.[0-9]+){1,3}$/.test(tag || '') || tag !== `v${version}`) throw new Error('Tag must match package.json version')
const revision = ref => execFileSync('git', ['rev-parse', ref], { encoding: 'utf8' }).trim()
if (revision(`${tag}^{commit}`) !== revision('HEAD')) throw new Error('Build must run at the tagged commit')

for (const browser of ['chromium', 'safari']) {
    const source = `release/sup5th-${browser}-v${version}.zip`
    if (!existsSync(source)) throw new Error(`Missing build: ${source}`)
}
writeFileSync('release/NOTES.md', `SUP 5th ${version}\n\n` +
    '- Chromium: для браузеров на Chromium. Установка из распакованной папки.\n' +
    '- Firefox: подписанное расширение для Firefox.\n' +
    '- Safari 18.4+ на Mac: неподписанный ZIP для временной установки через настройки разработчика.\n\n' +
    '[Установка](https://github.com/DIMaslov1904/sup5th#readme)\n')
console.log(`Prepared packages for ${tag}`)
