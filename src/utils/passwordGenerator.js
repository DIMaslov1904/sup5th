const chooseIndex = size => {
    const limit = Math.floor(0x100000000 / size) * size, value = new Uint32Array(1)
    do { crypto.getRandomValues(value) } while (value[0] >= limit)
    return value[0] % size
}
const latin = 'abcdefghijklmnopqrstuvwxyz', cyrillic = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'
export const generatePassword = ({ length = 20, alphabet = 'latin', lower = true, upper = true, digits = true, special = true, separators = false } = {}) => {
    if (!Number.isInteger(length) || length < 4 || length > 256) throw new Error('Длина: целое число от 4 до 256')
    if (!['latin', 'cyrillic', 'mixed'].includes(alphabet)) throw new Error('Выберите алфавит')
    const alphabets = alphabet === 'latin' ? [latin] : alphabet === 'cyrillic' ? [cyrillic] : [latin, cyrillic]
    const groups = [...alphabets.flatMap(letters => [lower && letters, upper && letters.toUpperCase()]), digits && '0123456789', special && '!@#$%^&*()+=?[]{}:.,'].filter(Boolean)
    if (!groups.length) throw new Error('Выберите хотя бы одну группу символов')
    if (separators) groups.push('-_')
    if (length < groups.length) throw new Error('Увеличьте длину: недостаточно места для всех групп символов')
    const pool = groups.join(''), chars = groups.map(value => value[chooseIndex(value.length)])
    while (chars.length < length) chars.push(pool[chooseIndex(pool.length)])
    for (let i = chars.length - 1; i > 0; i--) { const j = chooseIndex(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]] }
    return chars.join('')
}
