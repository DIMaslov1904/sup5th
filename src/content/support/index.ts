import "./index.scss";

interface ExtendedModal extends HTMLDialogElement {
  openModal: () => void;
  closeModal: () => void;
}

const iframeBody = document.getElementById("body-frame") as HTMLIFrameElement;
let d: Document = document;
let iframe: null | HTMLIFrameElement;
let ticketId: null | string;

const createModal = (
  name: string,
  fnOpen: Function = () => {},
  fnClose: Function = () => {},
): ExtendedModal => {
  const modal = document.createElement("dialog"),
    wrapper = document.createElement("div"),
    closeButton = document.createElement("button");

  const openModal = () => {
    fnOpen && fnOpen(modal);
    modal.showModal();
  };

  const closeModal = () => {
    modal.close();
    fnClose && fnClose(modal);
  };

  modal.id = name;
  modal.className = "modal";
  modal.addEventListener(
    "click",
    ({ currentTarget, target }) => target === currentTarget && closeModal(),
  );
  wrapper.className = "modal__wrapper";
  closeButton.className = "modal__close";
  closeButton.addEventListener("click", closeModal);

  wrapper.append(closeButton);
  modal.append(wrapper);
  document.body.append(modal);

  return Object.assign(modal, { openModal, closeModal });
};

const durationFormat = (duration: number): string => {
  let delta = duration / 1000,
    result = "";
  const days = Math.floor(delta / 86400);
  result += days ? `${days} дн ` : "";
  delta -= days * 86400;
  const hours = Math.floor(delta / 3600) % 24;
  result += hours ? hours + " ч " : "";
  delta -= hours * 3600;
  const minutes = Math.floor(delta / 60) % 60;
  result += minutes ? minutes + " м " : "";
  delta -= minutes * 60;
  const seconds = Math.floor(delta % 60);
  return result + seconds + " с";
};

const toggleDateTimeInput = (input: HTMLInputElement): void => {
  const startInput = input
    .closest("tr")
    ?.querySelector('input[name*="time_start"]') as HTMLInputElement;
  const endInput = input
    .closest("tr")
    ?.querySelector('input[name*="time_end"]') as HTMLInputElement;

  const interval = document.createElement("div");
  interval.style.position = "absolute";
  endInput.insertAdjacentElement("afterend", interval);

  input.addEventListener("focus", () => {
    input.type = "datetime-local";
    input.step = "1";
  });
  input.addEventListener("blur", () => {
    input.type = "text";
    input.value = input.value.replace("T", " ");

    const startDate = new Date(startInput.value);
    const endDate = new Date(endInput.value);

    startInput.style.border =
      endDate < startDate || !startInput.value ? "1px solid red" : "";
    endInput.style.border =
      endDate < startDate || !endInput.value ? "1px solid red" : "";

    interval.innerText =
      startInput.value && endInput.value
        ? durationFormat(endDate.getTime() - startDate.getTime())
        : "";
  });
};

const createIframe = (id: string): HTMLIFrameElement => {
  const ifrm = document.createElement("iframe");
  ifrm.classList.add("iframe");
  ifrm.src =
    "https://support.5th.ru/published/sta/work_log_edit.php?request_id=" + id;
  ifrm.onload = () =>
    (
      ifrm.contentWindow?.document.querySelectorAll(
        'input[name*="time"]',
      ) as NodeListOf<HTMLInputElement>
    ).forEach(toggleDateTimeInput);
  return ifrm;
};

const getRequestIdFromUrl = (): string => {
  const parts = window.location.hash.split("/");
  if (parts[parts.length - 2] === "id") return parts[parts.length - 1];
  return d.querySelector(".date.request-id b")?.innerHTML as string;
};

const prevOnOpenModal = () => {
  ticketId = getRequestIdFromUrl();
  iframe = createIframe(getRequestIdFromUrl());
  modal.children[0].append(iframe);
};

const nextOnCloseModal = () => {
  iframe && iframe.remove();
  const rowTicket = d.querySelector(`[rel='${ticketId}']`) as HTMLElement;
  if (rowTicket) return rowTicket.dispatchEvent(new Event("mousedown"));
  const iframeLocation = iframeBody?.contentWindow?.location as Location;
  (iframeLocation ? iframeLocation : location).reload();
};

const modal = createModal(
  "iframe-modal",
  prevOnOpenModal,
  nextOnCloseModal,
) as ExtendedModal;

const waitForElm = (selector: string): Promise<HTMLElement> => {
  return new Promise<HTMLElement>((resolve) => {
    const element = d.querySelector(selector) as HTMLElement;
    if (element) return resolve(element);
    const observer = new MutationObserver(() => {
      const element = d.querySelector(selector) as HTMLElement;
      if (!element) return;
      observer.disconnect();
      resolve(element);
    });
    observer.observe(d.body, { childList: true, subtree: true });
  });
};

const createBtn = () => {
  const btn = document.createElement("button") as HTMLButtonElement;
  btn.className =
    "ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only edit-time-taskt";
  btn.role = "button";
  const span = document.createElement("span");
  span.className = "ui-button-text";
  span.innerText = "Редактировать";
  btn.appendChild(span);
  return btn;
};

const getBtns = async () => {
  await waitForElm(".ticket-toolbar-bg .buttons");
  d.querySelectorAll(".ticket-toolbar-bg .buttons").forEach((wrap) => {
    const b = createBtn();
    b.addEventListener("click", modal.openModal);
    b.addEventListener("mouseover", () => {
      b.classList.add("ui-state-hover");
    });
    b.addEventListener("mouseout", () => {
      b.classList.remove("ui-state-hover");
    });
    wrap.insertBefore(b, wrap.children[0]);
  });
};

const updateContainerActions = async (mutationRecords: MutationRecord[]) => {
  try {
    if (
      (mutationRecords[1].addedNodes[0] as HTMLDivElement)?.id !==
      "ticket-wrapper"
    )
      return;
  } catch (error) {
    // ошибка при долгом выполнении задания
  }
  getBtns();
};

// Отслеживание изменение секции текущего тикета
const startObserverTicketWrapper = async () => {
  const wrap = (await waitForElm("#ticket-wrapper"))
    .parentElement as HTMLDivElement;
  getBtns();
  new MutationObserver(updateContainerActions).observe(wrap, {
    childList: true,
  });
};

// Если тикеты в iframe то дожидаемся его загрузки и меняем d
if (iframeBody)
  iframeBody.addEventListener("load", () => {
    d = iframeBody?.contentWindow?.document as Document;
    startObserverTicketWrapper();
  });
else startObserverTicketWrapper();
