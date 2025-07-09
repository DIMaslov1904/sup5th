/*
original: https://github.com/alexanderkx/ai-switcher-translit/tree/master


const str = "Ghbdtn Vbh!"
const output = swithcher.getSwitch(str)
console.log(output) // Привет Мир!


const str = "Руддщ Цщкдв! Ершы шы куыгде!"
const output = swithcher.getSwitch(str, {type: 'rueng'})
console.log(output) // Hello World! This is result!


const str = "Пример транслитерации!"
const output = swithcher.getSwitch(str, {type: 'translit'})
console.log(output) // Primer transliteracii!


const str = "Primer transliteracii!"
const output = swithcher.getSwitch(str, {type: 'retranslit'})
console.log(output) // Пример транслитерации!
*/

interface Config {
  dictionary: {
    keys: { [key: string]: string };
    translit: { [key: string]: string };
    retranslit: { [key: string]: string };
  };
  default?: { [key: string]: string };
}

type ConversionType = "rueng" | "engru" | "translit" | "retranslit";

interface Settings {
  type?: ConversionType;
}

const config: Config = {
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
      "?": ",",
    },
    translit: {
      а: "a",
      б: "b",
      в: "v",
      г: "g",
      д: "d",
      ё: "e",
      е: "e",
      ж: "zh",
      з: "z",
      и: "i",
      й: "y",
      к: "k",
      л: "l",
      м: "m",
      н: "n",
      о: "o",
      п: "p",
      р: "r",
      с: "s",
      т: "t",
      у: "u",
      ф: "f",
      х: "h",
      ц: "c",
      ч: "ch",
      ш: "sh",
      щ: "sch",
      ь: "'",
      ы: "i'",
      ъ: "",
      э: "e'",
      ю: "yu",
      я: "ya",
      А: "A",
      Б: "B",
      В: "V",
      Г: "G",
      Д: "D",
      Е: "E",
      Ё: "E",
      Ж: "Zh",
      З: "Z",
      И: "I",
      Й: "Y",
      К: "K",
      Л: "L",
      М: "M",
      Н: "N",
      О: "O",
      П: "P",
      Р: "R",
      С: "S",
      Т: "T",
      У: "U",
      Ф: "F",
      Х: "H",
      Ц: "C",
      Ч: "Ch",
      Ш: "Sh",
      Щ: "Sch",
      Ь: "'",
      Ы: "I'",
      Ъ: "",
      Э: "E'",
      Ю: "Yu",
      Я: "Ya",
    },
    retranslit: {
      Sch: "Щ",
      sch: "щ",
      Yu: "Ю",
      Ya: "Я",
      yu: "ю",
      ya: "я",
      Ch: "Ч",
      ch: "ч",
      Sh: "Ш",
      sh: "ш",
      "I'": "Ы",
      "i'": "ы",
      "e'": "э",
      "E'": "Э",
    },
  },
};

const _flip = function (trans: { [key: string]: string }): {
  [key: string]: string;
} {
  let key: string,
    tmp: { [key: string]: string } = {};
  for (key in trans) {
    tmp[trans[key]] = key;
  }
  return tmp;
};

const flippedKeys = _flip(config.dictionary.keys);
const flippedTranslit = _flip(config.dictionary.translit);

export default function (str: string, settings?: Settings): string {
  if (typeof str !== "string") throw new Error("Передана не строка");
  if (str.length === 0) return str;

  let mappingDict: { [key: string]: string } = {};

  const type = settings?.type || "engru";

  switch (type) {
    case "rueng":
      mappingDict = config.dictionary.keys;
      break;
    case "engru":
      mappingDict = flippedKeys;
      break;
    case "translit":
      mappingDict = config.dictionary.translit;
      break;
    case "retranslit":
      mappingDict = flippedTranslit;
      str = _fix(str);
      break;
    default:
      mappingDict = flippedKeys;
      break;
  }

  let textToArray: string[] = str.split(""),
    result: string[] = [];

  textToArray.forEach(function (sym: string, i: number) {
    if (mappingDict.hasOwnProperty(textToArray[i])) {
      result.push(mappingDict[textToArray[i]]);
    } else {
      result.push(sym);
    }
  });
  return result.join("");
}

const _fix = function (str: string): string {
  let obj = config.dictionary.retranslit;
  Object.keys(obj).map(function (key: string) {
    let reg = new RegExp("(" + key + ")", "g");
    str = str.replace(reg, (s: string) => {
      return obj[s];
    });
  });
  return str;
};
