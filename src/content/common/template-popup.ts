import { sendMessage } from "../../common/message-bus";

interface Template {
  id: string;
  name: string;
  command: string;
  text: string;
}

const variablePattern = /\{\{\s*([^{}]+?)\s*\}\}/g;

export function getTemplateVariables(text: string): string[] {
  return [
    ...new Set(
      [...text.matchAll(variablePattern)].map((match) => match[1].trim()),
    ),
  ];
}

export function renderSmartTemplate(
  text: string,
  values: ReadonlyMap<string, string>,
): string {
  return text.replace(
    variablePattern,
    (placeholder, field: string) => values.get(field.trim()) ?? placeholder,
  );
}

// HTML editors can collapse consecutive spaces and hide line-edge spaces.
// Keep ordinary single word separators so text can still wrap naturally.
export function preserveEditorSpaces(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/^ +| +$| {2,}/gm, (spaces) => "\u00a0".repeat(spaces.length));
}

// One controller per content-script document; delegated events also cover new editors.
export function startTemplatePopup(selector: string): void {
  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; position: fixed; z-index: 2147483647; display: none; }
    .popup { box-sizing: border-box; display: flex; flex-direction: column;
      width: 16.25rem; max-width: calc(100vw - 1rem); max-height: calc(100vh - 1rem);
      background: #FFFFFF; color: #171c26; border: 0; border-radius: 0.625rem;
      box-shadow: 0 0.375rem 1.5rem #0002; font: 0.8125rem/1.5 system-ui, sans-serif; overflow: hidden; }
    .popup.variable-entry { width: 17.5rem; }
    header, footer { flex-shrink: 0; }
    header { padding: 0.875rem 1rem 0.75rem; color: #171c26; font-size: 0.875rem;
      line-height: 1.4; font-weight: 600; overflow-wrap: anywhere; border-bottom: 0.0625rem solid #ededed; }
    footer { margin: 0 1rem; border-top: 0.0625rem solid #d9d9d9; }
    footer[hidden] { display: none; }
    footer.variables-footer { padding: 0.5625rem 0; color: #737373; font-size: 0.6875rem; line-height: 1.5; }
    .list { flex: 1; min-height: 0; max-height: 11.25rem; overflow-y: auto; }
    .list.variables { max-height: min(22.5rem, calc(100vh - 10rem)); }
    .list[role="listbox"] { padding: 0.625rem; scroll-padding-block: 0.625rem; }
    .section-title { margin: 0 0 0.625rem; font-size: 0.75rem; line-height: 1.5;
      font-weight: 600; color: #525252; }
    button { display: block; border: 0; background: white; color: inherit; width: 100%;
      text-align: left; cursor: pointer; padding: 0.5rem 0.75rem; font: inherit; }
    button[aria-selected="true"] { background: #d9d9d9; }
    button[role="option"] { box-sizing: border-box; display: grid;
      grid-template-columns: 3.5rem minmax(0, 1fr); align-items: center; gap: 0.5rem;
      height: 2.25rem; padding: 0 0.625rem; border-radius: 0.625rem; }
    .template-command { overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-size: 0.8125rem; font-weight: 600; }
    .template-text { min-width: 0; overflow: hidden; text-overflow: ellipsis;
      white-space: nowrap; color: #596375; font-size: 0.75rem; }
    .message { padding: 0.75rem; color: #6b7280; }
    form { padding: 0.875rem 1rem 0; display: grid; gap: 1rem; }
    .fields { display: grid; gap: 0.75rem; }
    label { display: grid; gap: 0.375rem; color: #525252; font-size: 0.75rem;
      font-weight: 500; overflow-wrap: anywhere; }
    input { box-sizing: border-box; width: 100%; border: 0.0625rem solid #d9d9d9;
      border-radius: 0.625rem; padding: 0.5625rem 0.625rem; font: 0.8125rem/1.5 system-ui, sans-serif;
      color: #171c26; background: #fff; }
    input::placeholder { color: #737373; }
    input:focus { background: #fff; border-color: #737373;
      outline: 0.125rem solid #737373; outline-offset: 0.0625rem; }
    .actions { display: flex; gap: 0.5rem;
      padding: 0.75rem 0; border-top: 0.0625rem solid #ededed; background: #fff; }
    .actions button { text-align: center; border: 0.0625rem solid #d9d9d9; border-radius: 0.625rem;
      background: #f5f5f5; color: #171c26; min-height: 2.25rem; font-size: 0.75rem; font-weight: 600; }
    .actions button:hover { background: #e5e5e5; }
    .actions button:focus-visible { outline: 0.125rem solid #737373; outline-offset: 0.0625rem; }
    .actions button[type="submit"] { background: #171c26; color: #fff; border-color: #171c26; }
    .actions button[type="submit"]:hover { background: #343a46; border-color: #343a46; }
  `;
  const popup = document.createElement("div");
  popup.className = "popup";
  const header = document.createElement("header");
  header.textContent = "템플릿";
  const list = document.createElement("div");
  list.className = "list";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "템플릿");
  const footer = document.createElement("footer");
  footer.hidden = true;
  popup.append(header, list, footer);
  shadow.append(style, popup);
  document.documentElement.append(host);

  let templates: Template[] | null = null;
  let filtered: Template[] = [];
  let active = 0;
  let trigger: Range | null = null;
  let editor: HTMLElement | null = null;
  let generation = 0;
  let composing = false;
  let enteringVariables = false;

  function close() {
    generation++;
    host.style.display = "none";
    trigger = null;
    enteringVariables = false;
  }

  function position() {
    if (!trigger || !editor) return;
    const rect = trigger.getBoundingClientRect();
    const anchor = rect.height ? rect : editor.getBoundingClientRect();
    host.style.display = "block";
    const width = popup.getBoundingClientRect().width;
    const height = popup.getBoundingClientRect().height;
    host.style.left = `${Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8))}px`;
    host.style.top = `${Math.max(
      8,
      anchor.bottom + height + 6 <= window.innerHeight
        ? anchor.bottom + 6
        : anchor.top - height - 6,
    )}px`;
  }

  function choose(template: Template) {
    if (!trigger || !editor || !editor.isConnected) return close();
    const variables = getTemplateVariables(template.text);
    if (!variables.length) return insertText(template.text);
    enteringVariables = true;
    popup.classList.add("variable-entry");
    generation++;
    header.textContent = template.name;
    footer.classList.add("variables-footer");
    footer.hidden = false;
    footer.textContent = "변수 입력 후 삽입 · Esc 취소";
    list.removeAttribute("role");
    list.classList.add("variables");
    list.replaceChildren();
    const form = document.createElement("form");
    const fieldsSection = document.createElement("section");
    fieldsSection.setAttribute("aria-label", "변수 입력");
    const fieldsTitle = document.createElement("h4");
    fieldsTitle.className = "section-title";
    fieldsTitle.textContent = "변수 입력";
    const fields = document.createElement("div");
    fields.className = "fields";
    fieldsSection.append(fieldsTitle, fields);
    form.append(fieldsSection);
    const inputs = new Map<string, HTMLInputElement>();
    for (const variable of variables) {
      const label = document.createElement("label");
      label.textContent = variable;
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = `${variable} 입력`;
      label.append(input);
      fields.append(label);
      inputs.set(variable, input);
    }
    const getRenderedText = () =>
      renderSmartTemplate(
        template.text,
        new Map([...inputs].map(([key, input]) => [key, input.value])),
      );
    const actions = document.createElement("div");
    actions.className = "actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "취소";
    cancel.addEventListener("click", cancelVariables);
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "삽입";
    actions.append(cancel, submit);
    form.append(actions);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (composing) return;
      insertText(getRenderedText());
    });
    list.append(form);
    position();
    inputs.values().next().value?.focus();
  }

  function cancelVariables() {
    const target = editor;
    const caret = trigger?.cloneRange();
    close();
    target?.focus();
    if (caret) {
      caret.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(caret);
    }
  }

  function insertText(text: string) {
    if (!trigger || !editor || !editor.isConnected) return close();
    const range = trigger.cloneRange();
    const insertionText = preserveEditorSpaces(text);
    const target = editor;
    close();
    target.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    // Native editing preserves the host editor's input handling and undo history.
    if (!document.execCommand("insertText", false, insertionText)) {
      range.deleteContents();
      const node = document.createTextNode(insertionText);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      target.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: insertionText,
        }),
      );
    }
  }

  function render(message?: string) {
    popup.classList.remove("variable-entry");
    header.textContent = "템플릿";
    footer.classList.remove("variables-footer");
    footer.replaceChildren();
    footer.hidden = true;
    list.setAttribute("role", "listbox");
    list.classList.remove("variables");
    list.replaceChildren();
    if (message || !filtered.length) {
      const empty = document.createElement("div");
      empty.className = "message";
      empty.textContent = message ?? "검색 결과가 없습니다.";
      list.append(empty);
    } else {
      filtered.forEach((template, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("role", "option");
        button.setAttribute("aria-selected", String(index === active));
        button.setAttribute(
          "aria-label",
          `${template.command} ${template.name}`,
        );
        const command = document.createElement("span");
        command.className = "template-command";
        command.textContent = template.command;
        const preview = document.createElement("span");
        preview.className = "template-text";
        preview.textContent = template.text.replace(/\s+/g, " ");
        button.title = template.text;
        button.append(command, preview);
        button.addEventListener("pointermove", () => {
          if (active === index) return;
          active = index;
          list
            .querySelectorAll('[role="option"]')
            .forEach((option, optionIndex) => {
              option.setAttribute(
                "aria-selected",
                String(optionIndex === active),
              );
            });
        });
        button.addEventListener("mousedown", (event) => event.preventDefault());
        button.addEventListener("click", () => choose(template));
        list.append(button);
      });
      list
        .querySelector('[aria-selected="true"]')
        ?.scrollIntoView({ block: "nearest" });
    }
    position();
  }

  async function update() {
    if (composing || enteringVariables || document.activeElement === host)
      return;
    const selection = window.getSelection();
    if (!selection?.isCollapsed || !selection.rangeCount) return close();
    const caret = selection.getRangeAt(0);
    const element =
      caret.startContainer.nodeType === Node.ELEMENT_NODE
        ? (caret.startContainer as Element)
        : caret.startContainer.parentElement;
    editor = element?.closest<HTMLElement>(selector) ?? null;
    if (!editor || document.activeElement !== editor) return close();
    const prefix = caret.cloneRange();
    prefix.selectNodeContents(editor);
    prefix.setEnd(caret.startContainer, caret.startOffset);
    const text = prefix.toString();
    const match = /(?:^|\s)(\/([^\s/]*))$/.exec(text);
    if (!match) return close();
    const start = text.length - match[1].length;
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let offset = 0;
    let node: Node | null;
    trigger = null;
    while ((node = walker.nextNode())) {
      const length = node.textContent?.length ?? 0;
      if (start < offset + length) {
        trigger = caret.cloneRange();
        trigger.setStart(node, start - offset);
        break;
      }
      offset += length;
    }
    if (!trigger) return close();
    const current = ++generation;
    active = 0;
    if (!templates) {
      filtered = [];
      render("템플릿 불러오는 중…");
      const response = await sendMessage({
        src: "CONTENT",
        dst: "BACKGROUND",
        method: "GET",
        path: "/editor/templates",
        data: {},
      });
      if (current !== generation) return;
      if (
        response?.statusCode !== 200 ||
        !Array.isArray(response.data?.templates)
      ) {
        render("템플릿을 불러오지 못했습니다. 다시 입력해주세요.");
        return;
      }
      templates = response.data.templates as Template[];
    }
    const query = match[2].toLocaleLowerCase();
    filtered = templates.filter((template) =>
      `${template.name} ${template.command} ${template.text}`
        .toLocaleLowerCase()
        .includes(query),
    );
    render();
  }

  // Keep editor/field focus when clicking popup chrome, previews, or buttons.
  // Inputs and their labels retain native focus and text-selection behavior.
  popup.addEventListener("mousedown", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest("input, label")) {
      event.preventDefault();
    }
  });

  document.addEventListener("input", () => {
    void update();
  });
  document.addEventListener("selectionchange", () => {
    void update();
  });
  document.addEventListener("compositionstart", () => {
    composing = true;
    if (!enteringVariables) close();
  });
  document.addEventListener("compositionend", () => {
    composing = false;
    void update();
  });
  // Intercept popup keys before the mail page's document handlers. Stopping
  // propagation preserves native input, IME, Tab navigation, and form submission.
  const stopPopupKeyPropagation = (event: KeyboardEvent) => {
    if (event.composedPath().includes(host)) event.stopImmediatePropagation();
  };
  window.addEventListener("keypress", stopPopupKeyPropagation, true);
  window.addEventListener("keyup", stopPopupKeyPropagation, true);
  window.addEventListener(
    "keydown",
    (event) => {
      stopPopupKeyPropagation(event);
      if (!trigger || composing || event.isComposing) return;
      if (enteringVariables) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopImmediatePropagation();
          cancelVariables();
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
      } else if (
        (event.key === "ArrowDown" || event.key === "ArrowUp") &&
        filtered.length
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        active =
          (active + (event.key === "ArrowDown" ? 1 : -1) + filtered.length) %
          filtered.length;
        render();
      } else if (event.key === "Enter" && filtered.length && !event.shiftKey) {
        event.preventDefault();
        event.stopImmediatePropagation();
        choose(filtered[active]);
      }
    },
    true,
  );
  document.addEventListener("mousedown", (event) => {
    if (!event.composedPath().includes(host)) close();
  });
  document.addEventListener("focusout", () => {
    // Wait until focus has moved from the editor into a variable field.
    queueMicrotask(() => {
      if (document.activeElement !== editor && !shadow.activeElement) close();
    });
  });
  window.addEventListener("resize", position);
  document.addEventListener("scroll", position, true);
}
