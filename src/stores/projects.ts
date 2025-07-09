import { defineStore } from "pinia";
import { ref } from "vue";
import { setToStorage, getFromStorage } from "@/utils/chrome-api";
import { getProjects, getAccess } from "@/utils/projects-api";
import { useNoticeStore } from "./notice";
import { cleanUrl, getDomain } from "@/utils/url";
import { IGNORE_SITE_ON_PROJECTS } from "@/globVars";

const STORAGE_NAME = "projectsState";

const defaultState = () => ({
  projects: [],
  isLoading: false,
  isLoadingAccess: false,
});
const defaultStateOne = (): Project => ({
  name: "",
  url: "",
  subdomain: false,
  urlAdmin: "",
  cms: "Нет",
  login: "",
  password: "",
  manual: "",
  git: "",
  figma: "",
  addDocument: "",
  updateAt: new Date().getTime(),
});
export const useProjectsStore = defineStore(STORAGE_NAME, () => {
  const state = ref<any>(defaultState());
  let projectUrls: string[] = [];

  const edit = (num: number, name: string, data: any) => {
    state.value.projects = state.value.projects.map((item: any) => {
      if (item.id === num) return { ...item, [name]: data };
      return item;
    });
    saveToStorage();
  };

  const add = async (data: Project) => {
    if (!data.url) return;
    for (const k in IGNORE_SITE_ON_PROJECTS) if (data.url.includes(k)) return;
    state.value.projects = [...state.value.projects, { ...data }];
    return true;
  };

  const remove = (url: string) => {
    state.value.projects = state.value.projects.filter(
      (el: Project) => el.url !== url,
    );
  };

  const getItem = (url: string) => {
    return state.value.projects.findIndex((item: any) => item.url === url);
  };

  const updateItem = async (index: number, data: any) => {
    let isUpdate = false;
    state.value.projects = state.value.projects.map((item: any, i: number) => {
      if (i === index) {
        for (const k in data) if (data[k] !== item[k]) isUpdate = true;
        if (isUpdate)
          return { ...item, ...data, updateAt: new Date().getTime() };
      }
      return item;
    });
    return isUpdate;
  };

  const update = async () => {
    const noticeStore = useNoticeStore();
    let countUpdate = 0;
    let constAdd = 0;
    const notFounds: string[] = [];

    state.value.isLoading = true;
    const res = await getProjects();

    if (res.result.length === 0) return (state.value.isLoading = false);

    let indexs =
      state.value.projects.length > 0
        ? [...Array(state.value.projects.length).keys()]
        : [];

    try {
      for (const item of res.result) {
        const newItem = {
          name: item[0],
          url: getDomain(item[1]),
          subdomain: item[2],
          urlAdmin: cleanUrl(item[4]),
          cms: item[5],
          manual: cleanUrl(item[3]),
          git: cleanUrl(item[6]),
          figma: cleanUrl(item[7]),
          addDocument: cleanUrl(item[8]),
        };
        const indexItem = getItem(newItem.url);

        if (indexItem !== -1) {
          indexs = indexs.filter((item: number) => item !== indexItem);
          projectUrls = projectUrls.filter((el) => el !== newItem.url);
          if (await updateItem(indexItem, newItem)) {
            countUpdate++;
          }
        } else {
          (await add({ ...defaultStateOne(), ...newItem })) && constAdd++;
        }
      }

      if (indexs.length !== 0)
        indexs.forEach((index: number) =>
          notFounds.push(
            `${state.value.projects[index].name} (${state.value.projects[index].url})`,
          ),
        );

      noticeStore.add(
        "success",
        "Проекты загружены<br>" +
          (countUpdate > 0 ? `Обновлено проектов: ${countUpdate}шт.<br>` : "") +
          (constAdd > 0 ? `Добавлено проектов: ${constAdd}шт.` : "") +
          (notFounds.length > 0
            ? `<br>Нет в общем списке:<ol><li>${notFounds.join(
                ";</li><li> ",
              )}</li></ol>`
            : ""),
        10,
      );

      saveToStorage();
    } catch (e) {
      noticeStore.add(
        "error",
        "<b>Ошибка загрузки проектов:</b><br>Не верная структура таблицы",
      );
      console.error(e);
    }

    state.value.isLoading = false;
  };

  const updateAccess = async () => {
    const noticeStore = useNoticeStore();
    let countUpdate = 0;
    const newProjects = [];

    state.value.isLoadingAccess = true;

    const res = await getAccess();

    if (res.result.length === 0) return (state.value.isLoadingAccess = false);

    for (const item of res.result) {
      const newItem = {
        url: getDomain(item[1]),
        login: item[2],
        password: item[3],
      };
      const indexItem = getItem(newItem.url);
      if (indexItem !== -1) {
        projectUrls = projectUrls.filter((el) => el !== newItem.url);
        if (await updateItem(indexItem, newItem)) {
          countUpdate++;
        }
      } else {
        (await add({ ...defaultStateOne(), ...newItem, name: item[0] })) &&
          newProjects.push(`${item[0]} (${newItem.url})`);
      }
    }

    noticeStore.add(
      "success",
      "Доступы загружены<br>" +
        (countUpdate > 0 ? `Обновлены доступы: ${countUpdate}шт.<br>` : "") +
        (newProjects.length > 0
          ? `Добавлено проектов из личного доступа:<ol> <li>${newProjects.join(
              ";</li><li> ",
            )}.</li></ol>`
          : ""),
      10,
    );

    saveToStorage();
    state.value.isLoadingAccess = false;
  };
  const updateAll = async () => {
    const noticeStore = useNoticeStore();

    state.value.projects.forEach((el: Project) => projectUrls.push(el.url));
    await update();
    await updateAccess();

    let deleteProjects = 0;

    projectUrls.forEach((url: string) => {
      remove(url);
      deleteProjects++;
    });

    if (deleteProjects > 0) {
      noticeStore.add(
        "success",
        `Проектов удалено: ${deleteProjects}шт.<br>` +
          `Проекты, которых больше вам не доступны:<ol> <li>${projectUrls.join(
            ";</li><li> ",
          )}.</li></ol>`,
      );
    }
    projectUrls = [];
  };

  const saveToStorage = () =>
    setToStorage(STORAGE_NAME, { projects: state.value.projects });

  const loadFromStorage = async () => {
    const result = await getFromStorage(STORAGE_NAME);
    state.value = {
      ...defaultState(),
      projects: result === undefined ? [] : result.projects,
    };
  };

  return {
    state,
    edit,
    update,
    remove,
    updateAccess,
    updateAll,
    loadFromStorage,
  };
});
