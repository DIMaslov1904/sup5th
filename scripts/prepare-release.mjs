import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const tag = process.env.RELEASE_TAG
if (!/^v[0-9]+(?:\.[0-9]+){1,3}$/.test(tag || '') || tag !== `v${version}`) throw new Error('Tag must match package.json version')
const revision = ref => execFileSync('git', ['rev-parse', ref], { encoding: 'utf8' }).trim()
if (revision(`${tag}^{commit}`) !== revision('HEAD')) throw new Error('Build must run at the tagged commit')

mkdirSync('release/assets', { recursive: true })
for (const browser of ['chrome', 'opera', 'firefox']) {
    const source = browser === 'firefox' ? `release/sup5th-firefox-v${version}.zip` : `release/sup5th-v${version}.zip`
    if (!existsSync(source)) throw new Error(`Missing build: ${source}`)
    copyFileSync(source, `release/assets/sup5th-${browser}-v${version}.zip`)
}
writeFileSync('release/NOTES.md', `SUP 5th ${version}\n\n` +
    '- Opera: ZIP для отправки в Opera Add-ons или временной проверки в режиме разработчика.\n' +
    '- Chrome: ZIP для ручной установки из распакованной папки.\n' +
    '- Firefox: неподписанный ZIP для проверки и отправки Mozilla. Подписанный XPI добавляется отдельно.\n\n' +
    'Биометрия Firefox экспериментальная: возможна ошибка RP ID.\n\n' +
    '[Установка](https://github.com/DIMaslov1904/sup5th#readme) · ' +
    '[Тестовые данные](https://github.com/DIMaslov1904/sup5th/blob/main/docs/TESTING.md) · ' +
    '[Выпуск в Opera](https://github.com/DIMaslov1904/sup5th/blob/main/docs/OPERA-ADDONS.md)\n')
console.log(`Prepared packages for ${tag}`)
