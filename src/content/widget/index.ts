import "./index.scss";

const cmsList: { [key: string]: string } = {
  UMI: "admin/content/sitetree/",
  EzPro: "ezpro/",
  Bitrix: "bitrix/admin/#authorize",
  ABO: "login.php",
  MODX: "manager/",
  AdminLTE: "admin/",
  Joomla: "administrator/",
};

const getUrlAdminLogin = (urlAdmin: string, cms: CMSName) => {
  switch (cms) {
    case "Нет":
    case "":
      return "#";
    case "Своя":
    case "WordPress":
      return "https://" + urlAdmin;
    case "Tilda":
      return "https://tilda.ru/login/";
    default:
      return `/${cmsList[cms]}`;
  }
};

const getVal = (
  num: number,
  attr: { min?: number; max?: number } = {}
): number => {
  if (!num) return 0;
  let res = Math.trunc(num);
  if (attr.min !== undefined) res = Math.max(res, attr.min);
  if (attr.max !== undefined) res = Math.min(res, attr.max);
  return res;
};

let storage: ProjectStorage | null = null,
  currentProject: Project | null = null,
  floatingWidget: HTMLElement | null = null,
  isAdminPage: boolean = false;

const STORAGE_NAME = "projectsState";

const getProjectImg = (name: string) => {
  let nameFile =
    name === "Своя" ? "cms" : name === "Нет" ? "hosting" : name.toLowerCase();
  return chrome.runtime.getURL(`/assets/icons/${nameFile}.svg`);
};

const getFromStorage = async () => {
  try {
    const result = await chrome.storage.local.get([STORAGE_NAME]);
    if (result[STORAGE_NAME] !== undefined)
      return JSON.parse(result[STORAGE_NAME]);
    return null;
  } catch (error) {
    console.error(
      new Date().toLocaleString() + "Ошибка при получении из хранилища:",
      error
    );
    return null;
  }
};

const setToStorage = async (data: Record<string, any>) => {
  try {
    await chrome.storage.local.set({ [STORAGE_NAME]: JSON.stringify(data) });
  } catch (error) {
    console.error(
      new Date().toLocaleString() + "Ошибка при сохранении в хранилище:",
      error
    );
  }
};

const saveWidgetPosition = async (): Promise<void> => {
  storage = (await getFromStorage()) as ProjectStorage;
  if (!storage) return;
  let widgetPosition = undefined;
  if (
    currentProject?.widgetPosition &&
    (currentProject.widgetPosition.x || currentProject.widgetPosition?.y)
  )
    widgetPosition = currentProject.widgetPosition;
  storage.projects = storage.projects.map((item: any) =>
    item.url === currentProject?.url ? { ...item, widgetPosition } : item
  );
  await setToStorage(storage);
};

const loginAdminPanelSecond = async () => {
  if (!currentProject?.cms) return;

  const loginBitrix = async () => {
    if (!document.querySelector("[name=USER_LOGIN]")) return;
    const inputLogin = document.querySelector(
        "[name=USER_LOGIN]"
      ) as HTMLInputElement,
      inputPassword = document.querySelector(
        "[name=USER_PASSWORD]"
      ) as HTMLInputElement,
      inputLoginBtn = document.querySelector(
        "[name=Login]"
      ) as HTMLInputElement;
    inputLogin.value = currentProject?.login || "";
    inputPassword.value = currentProject?.password || "";
    inputLoginBtn.click();
  };

  const loginModx = async () => {
    if (!document.querySelector("[name=username]")) return;
    const inputLogin = document.querySelector(
        "[name=username]"
      ) as HTMLInputElement,
      inputPassword = document.querySelector(
        "[name=password]"
      ) as HTMLInputElement,
      inputLoginBtn = document.querySelector(
        "[name=login]"
      ) as HTMLInputElement;
    inputLogin.value = currentProject?.login || "";
    inputPassword.value = currentProject?.password || "";
    inputLoginBtn.click();
  };

  const loginTilda = async () => {
    if (!document.querySelector("[name=email]")) return;
    const inputLogin = document.querySelector(
        "[name=email]"
      ) as HTMLInputElement,
      inputPassword = document.querySelector(
        "[name=password]"
      ) as HTMLInputElement,
      inputLoginBtn = document.querySelector("#send") as HTMLInputElement;
    inputLogin.value = currentProject?.login || "";
    inputPassword.value = currentProject?.password || "";
    if (!document.querySelector("#recaptcha_div")) inputLoginBtn.click();
  };

  switch (currentProject?.cms) {
    case "Bitrix":
      await loginBitrix();
      break;
    case "MODX":
      await loginModx();
      break;
    case "Tilda":
      await loginTilda();
  }
  sessionStorage.removeItem("login");
};

const loginAdminPanel = async (target: string) => {
  if (!currentProject?.cms)
    return window.open(currentProject?.urlAdmin, target);

  const loginUmi = async () => {
    const urlAdmin = "/admin/content/sitetree/";
    const urlLoginAdmin = "/admin/users/login_do/";

    try {
      await fetch(urlAdmin, {
        method: "HEAD",
        credentials: "include",
        redirect: "error",
      });
      return window.open(urlAdmin, target);
    } catch (er) {}

    const formData = new FormData();
    Object.entries({
      login: currentProject?.login,
      password: currentProject?.password,
      ilang: "ru",
      "save-auth-token": 1,
    }).forEach(([key, value]) => formData.append(key, value?.toString() || ""));

    await fetch(urlLoginAdmin, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    window.open(urlAdmin, target);
  };

  const loginBitrix = async () => {
    const urlLoginAdmin = "/bitrix/admin/#authorize";
    sessionStorage.setItem("login", "1");
    window.open(urlLoginAdmin, target);
  };

  const loginModx = async () => {
    const urlLoginAdmin = "/manager/";
    sessionStorage.setItem("login", "1");
    window.open(urlLoginAdmin, target);
  };

  const loginAbo = async () => {
    const urlAdmin = "/admin.php";
    const urlLoginAdmin = "/login.php";

    try {
      await fetch(urlAdmin, {
        method: "HEAD",
        credentials: "include",
        redirect: "error",
      });
      return window.open(urlAdmin, target);
    } catch (er) {}

    const formData = new FormData();
    Object.entries({
      email: currentProject?.login,
      password: currentProject?.password,
      validate: true,
    }).forEach(([key, value]) => formData.append(key, value?.toString() || ""));

    await fetch(urlLoginAdmin, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    window.open(urlAdmin, target);
  };

  const loginTilda = async () => {
    const urlAdmin = "https://tilda.ru/projects/";
    const urlLoginAdmin = "https://tilda.ru/login/";

    try {
      await fetch(urlAdmin, {
        method: "HEAD",
        credentials: "include",
        redirect: "error",
      });
      return window.open(urlAdmin, target);
    } catch (er) {}

    chrome.storage.local.set({ tildaLogin: JSON.stringify(currentProject) });
    window.open(urlLoginAdmin, target);
  };

  switch (currentProject?.cms) {
    case "UMI":
      return await loginUmi();
    case "Bitrix":
      return await loginBitrix();
    case "MODX":
      return await loginModx();
    case "ABO":
      return await loginAbo();
    case "Tilda":
      return await loginTilda();
    default:
      window.open(
        getUrlAdminLogin(currentProject.urlAdmin, currentProject.cms),
        target
      );
  }
};

const checkAdmin = async () => {
  if (
    !currentProject ||
    !window.location.href.includes(currentProject?.urlAdmin)
  )
    return;
  isAdminPage = true;
  if (sessionStorage.getItem("login")) loginAdminPanelSecond();
};

const checkCurrentProject = async (): Promise<void> => {
  if (window.location.href.includes("tilda.ru/login")) {
    const result = await chrome.storage.local.get(["tildaLogin"]);
    if (result["tildaLogin"] !== undefined) {
      currentProject = JSON.parse(result["tildaLogin"]);
      loginAdminPanelSecond();
    }
  }
  storage = (await getFromStorage()) as ProjectStorage;
  if (!storage) return;
  const currentDomain = new URL(window.location.href).hostname;
  currentProject =
    storage.projects.find((project) =>
      project.url
        ? project.subdomain
          ? currentDomain.includes(project.url)
          : currentDomain === project.url
        : false
    ) || null;
  if (currentProject) {
    checkAdmin();
    createFloatingWidget();
  }
};

const createFloatingWidget = async (): Promise<void> => {
  // Добавляем стили
  const styleSheet = document.createElement("link");
  styleSheet.href = chrome.runtime.getURL("widget.css");
  styleSheet.rel = "stylesheet";
  document.head.appendChild(styleSheet);

  // Сам виджет
  floatingWidget = document.createElement("div");
  floatingWidget.className = "sup-5th-widget";

  // Кнопка открытия закрытия виджета с лого cms
  const btnMenu = document.createElement("button");
  btnMenu.className = "sup-5th-btn sup-5th-menu";
  btnMenu.title = "Нажмите для открытия / Зажмите для переноса";
  btnMenu.setAttribute(
    "style",
    `background-image: url(${getProjectImg(currentProject?.cms || "cms")})`
  );
  btnMenu.addEventListener("click", () => {
    if (!floatingWidget) return;
    const style = window.getComputedStyle(floatingWidget);
    if (
      style.getPropertyValue("flex-direction") === "row" &&
      !floatingWidget?.classList.contains("open")
    ) {
      floatingWidget.style.setProperty(
        "--translate",
        `translate(min(max(calc(var(--x) + ${
          (floatingWidget.childElementCount - 1) * 68
        }px), calc((100dvw - var(--width) - var(--offset)) * -1)), 0dvw), min(max(var(--y), calc((100dvh - var(--height) - var(--offset)) * -1)), 0dvh))`
      );
    } else {
      floatingWidget.style.setProperty(
        "--translate",
        `translate(min(max(var(--x), calc((100dvw - var(--width) - var(--offset)) * -1)), 0dvw), min(max(var(--y), calc((100dvh - var(--height) - var(--offset)) * -1)), 0dvh))`
      );
    }

    floatingWidget?.classList.toggle("open");
  });
  floatingWidget.appendChild(btnMenu);

  // Кнопка админки
  if (currentProject && currentProject.urlAdmin) {
    const btnAdm = document.createElement("button");
    btnAdm.className = "sup-5th-btn";
    btnAdm.title = isAdminPage ? "Перейти на сайт" : "Перейти в админку";
    btnAdm.innerHTML = isAdminPage
      ? `
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="https://www.w3.org/2000/svg">
      <path d="M16 29.3333C23.3637 29.3333 29.3333 23.3637 29.3333 16C29.3333 8.63619 23.3637 2.66666 16 2.66666C8.63616 2.66666 2.66663 8.63619 2.66663 16C2.66663 23.3637 8.63616 29.3333 16 29.3333Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <g opacity="0.4">
      <path d="M10.6661 4H11.9994C9.39944 11.7867 9.39944 20.2133 11.9994 28H10.6661" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M20 4C22.6 11.7867 22.6 20.2133 20 28" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M4 21.3333V20C11.7867 22.6 20.2133 22.6 28 20V21.3333" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M4 12.0001C11.7867 9.40014 20.2133 9.40014 28 12.0001" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    </svg>
    `
      : `
    <svg xmlns="https://www.w3.org/2000/svg" width="0" viewBox="0 0 32 32" fill="none">
      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M29.333 16C29.333 8.64 23.36 2.667 16 2.667S2.667 8.64 2.667 16 8.64 29.333 16 29.333"/>
      <g stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" opacity=".4">
        <path d="M10.666 4H12a37.899 37.899 0 0 0 0 24h-1.333M20 4a38.074 38.074 0 0 1 1.947 12"/>
        <path d="M4 21.333V20a38.074 38.074 0 0 0 12 1.947M4 12a37.899 37.899 0 0 1 24 0"/>
      </g>
      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="1.5" d="m25.615 20.987-4.72 4.72c-.187.186-.36.533-.4.786l-.254 1.8c-.093.654.36 1.107 1.014 1.014l1.8-.254c.253-.04.613-.213.786-.4l4.72-4.72c.814-.813 1.2-1.76 0-2.96-1.186-1.186-2.133-.8-2.946.014Z"/>
      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="1.5" d="M24.932 21.667c.4 1.44 1.52 2.56 2.96 2.96"/>
    </svg>
    `;
    btnAdm.addEventListener("mousedown", (e) => {
      if (!currentProject || !(e.buttons === 1 || e.buttons === 4)) return;
      const target = e.buttons === 1 ? "_self" : "_blank";
      isAdminPage ? window.open("/", target) : loginAdminPanel(target);
    });
    floatingWidget.appendChild(btnAdm);
  }

  // Кнопка инструкции
  if (currentProject && currentProject.manual) {
    const btnManual = document.createElement("a");
    btnManual.target = "_blank";
    btnManual.className = "sup-5th-btn";
    btnManual.title = "Инструкция";
    btnManual.href = "https://" + currentProject.manual;
    btnManual.innerHTML = `
    <svg xmlns="https://www.w3.org/2000/svg" width="0" viewBox="0 0 32 32" fill="none">
      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M29.333 22.32V6.227c0-1.6-1.306-2.787-2.893-2.653h-.08c-2.8.24-7.053 1.666-9.427 3.16l-.226.146c-.387.24-1.027.24-1.414 0l-.333-.2C12.587 5.2 8.347 3.787 5.547 3.56c-1.587-.133-2.88 1.067-2.88 2.654V22.32c0 1.28 1.04 2.48 2.32 2.64l.386.054c2.894.386 7.36 1.853 9.92 3.253l.054.027c.36.2.933.2 1.28 0 2.56-1.414 7.04-2.894 9.946-3.28l.44-.054c1.28-.16 2.32-1.36 2.32-2.64Z"/>
      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7.32v20m-5.667-16h-3m4 4h-4" opacity=".4"/>
    </svg>
    `;
    floatingWidget.appendChild(btnManual);
  }

  // Кнопка доп документа
  if (currentProject && currentProject.addDocument) {
    const btnAddDocument = document.createElement("a");
    btnAddDocument.target = "_blank";
    btnAddDocument.className = "sup-5th-btn";
    btnAddDocument.title = "Доп документ";
    btnAddDocument.href = "https://" + currentProject.addDocument;
    btnAddDocument.innerHTML = `
    <svg xmlns="https://www.w3.org/2000/svg" width="0" viewBox="0 0 32 32" fill="none">
      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="1.5" d="M28 9.333v13.334c0 4-2 6.666-6.667 6.666H10.667C6 29.333 4 26.667 4 22.667V9.333c0-4 2-6.666 6.667-6.666h10.666C26 2.667 28 5.333 28 9.333Z"/>
      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-width="1.5" d="M19.333 6v2.667c0 1.466 1.2 2.666 2.667 2.666h2.667m-14 6H16m-5.333 5.334h10.666" opacity=".4"/>
    </svg>
    `;
    floatingWidget.appendChild(btnAddDocument);
  }

  const position = currentProject?.widgetPosition || { x: 0, y: 0 };
  floatingWidget.style.setProperty("--x", `${position.x}dvw`);
  floatingWidget.style.setProperty("--y", `${position.y}dvh`);
  floatingWidget.style.setProperty(
    "flex-direction",
    `${position.x > -50 ? "row-reverse" : "row"}`
  );

  makeDraggable(floatingWidget);

  document.body.appendChild(floatingWidget);

  floatingWidget.style.setProperty(
    "--width-full",
    `${floatingWidget.childElementCount * 68}px`
  );
};

const makeDraggable = (element: HTMLElement): void => {
  let dragging = false,
    isClick = false,
    clictX = 0,
    clickY = 0,
    startX = 0,
    startY = 0;

  const getPropertyXandY = (): { x: number; y: number } => {
    const style = window.getComputedStyle(element);
    return {
      x: parseInt(style.getPropertyValue("--x")),
      y: parseInt(style.getPropertyValue("--y")),
    };
  };

  element.addEventListener("mousedown", (e) => {
    if (e.buttons !== 1) return;
    isClick = true;
    clictX = e.pageX;
    clickY = e.pageY;
    const { x, y } = getPropertyXandY();
    startX = e.pageX - (x / 100) * window.innerWidth;
    startY = e.pageY - (y / 100) * window.innerHeight;
  });

  document.body.addEventListener("mouseup", async () => {
    dragging = false;
    isClick = false;
    element.classList.remove("dragging");
    if (!currentProject) return;
    currentProject.widgetPosition = getPropertyXandY();
    await saveWidgetPosition();
  });

  document.body.addEventListener("mousemove", (e) => {
    if (
      isClick &&
      (Math.abs(clictX - e.pageX) > 2 || Math.abs(clickY - e.pageY) > 2)
    ) {
      isClick = false;
      dragging = true;
      element.classList.add("dragging");
    }

    if (!dragging) return;
    const posX = getVal(((startX - e.pageX) * -100) / window.innerWidth, {
      min: -99,
      max: 0,
    });
    element.style.setProperty("--x", `${posX}dvw`);
    element.style.setProperty(
      "--y",
      `${getVal(((startY - e.pageY) * -100) / window.innerHeight, {
        min: -99,
        max: 0,
      })}dvh`
    );
    element.style.setProperty(
      "flex-direction",
      `${posX > -50 ? "row-reverse" : "row"}`
    );
  });
};

checkCurrentProject();
