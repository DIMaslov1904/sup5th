type InputDate = Date | string | number | null;

export function parsDate(date: InputDate) {
  if (!date) {
    return null;
  } else if (typeof date === "string") {
    return new Date(date);
  } else if (typeof date === "number") {
    return new Date(String(date).length === 10 ? date * 1000 : date);
  } else {
    return date;
  }
}

function checkDate(date: InputDate) {
  return date instanceof Date ? date : parsDate(date);
}

export function formateDate(date: InputDate, format: string = "YYYY-MM-DD") {
  const fDate = checkDate(date);
  if (!fDate) return "";
  return format
    .replace(/\bYYYY\b/, String(fDate.getFullYear()))
    .replace(/\bDD\b/, String(fDate.getDate()).padStart(2, "0"))
    .replace(/\bMM\b/, String(fDate.getMonth() + 1).padStart(2, "0"));
}

export const formateDateRu = (date: InputDate) => {
  const fDate = checkDate(date);
  if (!fDate) return "";
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  };
  return new Intl.DateTimeFormat("ru-RU", options).format(fDate);
};
