/**
 * Переключатель раскладки клавиатуры и транслитерация.
 * Перенесён из старого расширения (src/utils/switcher.ts).
 *
 * Примеры:
 *   switcher("Ghbdtn Vbh!")                          // Привет Мир! (eng -> ru)
 *   switcher("Руддщ Цщкдв!", { type: "rueng" })      // Hello World!  (ru -> eng)
 *   switcher("Пример!", { type: "translit" })        // Primer!       (ru -> en транслит)
 *   switcher("Primer!", { type: "retranslit" })      // Пример!       (en транслит -> ru)
 */

const config = {
    dictionary: {
        keys: {
            й: "q",
            ц: "w",
            у: "e",
            к: "r",
            е: "t",
            н: "y",
            г: "u",
            ш: "i",
            щ: "o",
            з: "p",
            х: "[",
            ъ: "]",
            ф: "a",
            ы: "s",
            в: "d",
            а: "f",
            п: "g",
            р: "h",
            о: "j",
            л: "k",
            д: "l",
            ж: "",
            э: "'",
            я: "z",
            Ч: "X",
            с: "c",
            м: "v",
            и: "b",
            т: "n",
            ь: "m",
            б: ",",
            ю: ".",
            Й: "Q",
            Ц: "W",
            У: "E",
            К: "R",
            Е: "T",
            Н: "Y",
            Г: "U",
            Ш: "I",
            Щ: "O",
            З: "P",
            Х: "[",
            Ъ: "]",
            Ф: "A",
            Ы: "S",
            В: "D",
            А: "F",
            П: "G",
            Р: "H",
            О: "J",
            Л: "K",
            Д: "L",
            Ж: "",
            Э: "'",
            Я: "Z",
            ч: "x",
            С: "C",
            М: "V",
            И: "B",
            Т: "N",
            Ь: "M",
            Б: ",",
            Ю: ".",
            ё: "`",
            "№": "#",
            "/": ".",
            "?": ","
        },
        translit: {
            а: "a", б: "b", в: "v", г: "g", д: "d", ё: "e", е: "e", ж: "zh", з: "z", и: "i",
            й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
            у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ь: "'", ы: "i'", ъ: "",
            э: "e'", ю: "yu", я: "ya",
            А: "A", Б: "B", В: "V", Г: "G", Д: "D", Е: "E", Ё: "E", Ж: "Zh", З: "Z", И: "I",
            Й: "Y", К: "K", Л: "L", М: "M", Н: "N", О: "O", П: "P", Р: "R", С: "S", Т: "T",
            У: "U", Ф: "F", Х: "H", Ц: "C", Ч: "Ch", Ш: "Sh", Щ: "Sch", Ь: "'", Ы: "I'", Ъ: "",
            Э: "E'", Ю: "Yu", Я: "Ya"
        },
        retranslit: {
            Sch: "Щ", sch: "щ", Yu: "Ю", Ya: "Я", yu: "ю", ya: "я",
            Ch: "Ч", ch: "ч", Sh: "Ш", sh: "ш",
            "I'": "Ы", "i'": "ы", "e'": "э", "E'": "Э"
        }
    }
}

const flip = (trans) => {
    const result = {}
    for (const key in trans) {
        result[trans[key]] = key
    }
    return result
}

const flippedKeys = flip(config.dictionary.keys)
const flippedTranslit = flip(config.dictionary.translit)

const fixRetranslit = (str) => {
    const obj = config.dictionary.retranslit
    for (const key of Object.keys(obj)) {
        const reg = new RegExp(`(${key})`, 'g')
        str = str.replace(reg, (matched) => obj[matched])
    }
    return str
}

/**
 * Конвертирует строку между раскладками.
 * @param {string} str - исходная строка
 * @param {{ type?: 'engru'|'rueng'|'translit'|'retranslit' }} [settings]
 */
export default function switcher(str, settings = {}) {
    if (typeof str !== 'string') throw new Error('Передана не строка')
    if (str.length === 0) return str

    let mappingDict = {}
    const type = settings.type || 'engru'

    switch (type) {
        case 'rueng':
            mappingDict = config.dictionary.keys
            break
        case 'engru':
            mappingDict = flippedKeys
            break
        case 'translit':
            mappingDict = config.dictionary.translit
            break
        case 'retranslit':
            mappingDict = flippedTranslit
            str = fixRetranslit(str)
            break
        default:
            mappingDict = flippedKeys
            break
    }

    return str
        .split('')
        .map((symbol) => (Object.prototype.hasOwnProperty.call(mappingDict, symbol) ? mappingDict[symbol] : symbol))
        .join('')
}
