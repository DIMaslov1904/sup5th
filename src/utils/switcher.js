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
            а: "a", б: "b", в: "v", г: "g", д: "d", ё: "yo", е: "e", ж: "zh", з: "z", и: "i",
            й: "j", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
            у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ь: "ʹ", ы: "y", ъ: "ʺ",
            э: "e", ю: "yu", я: "ya",
            А: "A", Б: "B", В: "V", Г: "G", Д: "D", Е: "E", Ё: "Yo", Ж: "Zh", З: "Z", И: "I",
            Й: "J", К: "K", Л: "L", М: "M", Н: "N", О: "O", П: "P", Р: "R", С: "S", Т: "T",
            У: "U", Ф: "F", Х: "Kh", Ц: "Ts", Ч: "Ch", Ш: "Sh", Щ: "Shch", Ь: "ʹ", Ы: "Y", Ъ: "ʺ",
            Э: "E", Ю: "Yu", Я: "Ya"
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
// Е/Э and the case of signs are ambiguous in reverse; prefer е, ь and ъ.
const flippedTranslit = { ...flip(config.dictionary.translit), e: 'е', E: 'Е', 'ʹ': 'ь', 'ʺ': 'ъ' }
const retranslitPattern = new RegExp(Object.keys(flippedTranslit).sort((a, b) => b.length - a.length).join('|'), 'g')

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
            return str.replace(retranslitPattern, symbol => flippedTranslit[symbol])
        default:
            mappingDict = flippedKeys
            break
    }

    return str
        .split('')
        .map((symbol) => (Object.prototype.hasOwnProperty.call(mappingDict, symbol) ? mappingDict[symbol] : symbol))
        .join('')
}
