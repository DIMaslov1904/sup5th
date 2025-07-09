import { URL_IMG_CMS } from "@/globVars";

export const getIcon = (name: string) => {
  let nameFile = "";
  switch (name) {
    case "Своя":
      nameFile = "cms";
      break;
    case "Нет":
      nameFile = "hosting";
      break;
    default:
      nameFile = name.toLowerCase();
  }
  return chrome.runtime.getURL(URL_IMG_CMS.replace("{}", nameFile));
};
