import { preserveEditorSpaces } from "./editor-whitespace";
import { getTemplateVariables, renderSmartTemplate } from "./smart-template";
import { sendMessage } from "../../common/message-bus";

interface Template {
  id: string;
  name: string;
  command: string;
  text: string;
}

// One controller per content-script document; delegated events also cover new editors.
export function startTemplatePopup(selector: string): void {
  const host = document.createElement("div");
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; position: fixed; z-index: 2147483647; display: none; }
    .popup { box-sizing: border-box; width: 280px; max-width: calc(100vw - 16px);
      background: white; color: #202124; border: 1px solid #e1e3e7; border-radius: 10px;
      box-shadow: 0 6px 24px #0002; font: 13px/1.5 system-ui, sans-serif; overflow: hidden; }
    header, footer { padding: 8px 12px; color: #6b7280; font-size: 11px; }
    header { font-weight: 600; border-bottom: 1px solid #eee; }
    .list { max-height: 180px; overflow-y: auto; }
    .list.variables { max-height: min(360px, calc(100vh - 100px)); }
    .preview-title { margin: 0 0 4px; font-size: 11px; color: #6b7280; }
    .preview { margin: 0; padding: 8px; max-height: 120px; overflow-y: auto;
      border: 1px solid #e1e3e7; border-radius: 6px; background: #f8fafc;
      white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; }
    button { display: block; border: 0; background: white; color: inherit; width: 100%;
      text-align: left; cursor: pointer; padding: 8px 12px; font: inherit; }
    button[aria-selected="true"] { background: #eef2ff; color: #4338ca; }
    small { display: block; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .message { padding: 12px; color: #6b7280; }
    form { padding: 12px; display: grid; gap: 10px; }
    label { display: grid; gap: 4px; }
    input { box-sizing: border-box; width: 100%; border: 1px solid #d1d5db;
      border-radius: 6px; padding: 7px 8px; font: inherit; color: #202124; background: white; }
    input:focus { outline: 2px solid #818cf8; outline-offset: 1px; }
    .actions { display: flex; gap: 8px; }
    .actions button { text-align: center; border: 1px solid #d1d5db; border-radius: 6px; }
    .actions button[type="submit"] { background: #4338ca; color: white; border-color: #4338ca; }
  `;
  const popup = document.createElement("div");
  popup.className = "popup";
  const header = document.createElement("header");
  header.textContent = "스마트 템플릿";
  const list = document.createElement("div");
  list.className = "list";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "스마트 템플릿");
  const footer = document.createElement("footer");
  footer.textContent = "↑↓ 선택 · Enter 삽입 · Esc 닫기";
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
    host.style.top = `${Math.max(8, anchor.bottom + height + 6 <= window.innerHeight
      ? anchor.bottom + 6 : anchor.top - height - 6)}px`;
  }

  function choose(template: Template) {
    if (!trigger || !editor || !editor.isConnected) return close();
    const variables = getTemplateVariables(template.text);
    if (!variables.length) return insertText(template.text);
    enteringVariables = true;
    generation++;
    header.textContent = template.name;
    footer.textContent = "변수 입력 후 삽입 · Esc 취소";
    list.removeAttribute("role");
    list.classList.add("variables");
    list.replaceChildren();
    const form = document.createElement("form");
    const inputs = new Map<string, HTMLInputElement>();
    for (const variable of variables) {
      const label = document.createElement("label");
      label.textContent = variable;
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = `${variable} 입력`;
      label.append(input);
      form.append(label);
      inputs.set(variable, input);
    }
    const getRenderedText = () => renderSmartTemplate(template.text,
      new Map([...inputs].map(([key, input]) => [key, input.value])));
    const previewSection = document.createElement("section");
    previewSection.setAttribute("aria-label", "삽입할 텍스트 미리보기");
    const previewTitle = document.createElement("h4");
    previewTitle.className = "preview-title";
    previewTitle.textContent = "미리보기";
    const preview = document.createElement("pre");
    preview.className = "preview";
    preview.textContent = getRenderedText();
    form.addEventListener("input", () => {
      preview.textContent = getRenderedText();
      position();
    });
    previewSection.append(previewTitle, preview);
    form.append(previewSection);
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
    form.addEventListener("submit", event => {
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
      target.dispatchEvent(new InputEvent("input", {
        bubbles: true, inputType: "insertText", data: insertionText,
      }));
    }
  }

  function render(message?: string) {
    header.textContent = "스마트 템플릿";
    footer.textContent = "↑↓ 선택 · Enter 삽입 · Esc 닫기";
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
        button.textContent = `${template.name}  ${template.command}`;
        const preview = document.createElement("small");
        preview.textContent = template.text;
        button.append(preview);
        button.addEventListener("mousedown", event => event.preventDefault());
        button.addEventListener("click", () => choose(template));
        list.append(button);
      });
      list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
    }
    position();
  }

  async function update() {
    if (composing || enteringVariables || document.activeElement === host) return;
    const selection = window.getSelection();
    if (!selection?.isCollapsed || !selection.rangeCount) return close();
    const caret = selection.getRangeAt(0);
    const element = caret.startContainer.nodeType === Node.ELEMENT_NODE
      ? caret.startContainer as Element : caret.startContainer.parentElement;
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
        src: "CONTENT", dst: "BACKGROUND", method: "GET", path: "/editor/templates", data: {},
      });
      if (current !== generation) return;
      if (response?.statusCode !== 200 || !Array.isArray(response.data?.templates)) {
        render("템플릿을 불러오지 못했습니다. 다시 입력해주세요.");
        return;
      }
      templates = response.data.templates as Template[];
    }
    const query = match[2].toLocaleLowerCase();
    filtered = templates.filter(template =>
      `${template.name} ${template.command} ${template.text}`.toLocaleLowerCase().includes(query));
    render();
  }

  // Keep editor/field focus when clicking popup chrome, previews, or buttons.
  // Inputs and their labels retain native focus and text-selection behavior.
  popup.addEventListener("mousedown", event => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest("input, label")) {
      event.preventDefault();
    }
  });

  document.addEventListener("input", () => { void update(); });
  document.addEventListener("selectionchange", () => { void update(); });
  document.addEventListener("compositionstart", () => {
    composing = true;
    if (!enteringVariables) close();
  });
  document.addEventListener("compositionend", () => { composing = false; void update(); });
  // Intercept popup keys before the mail page's document handlers. Stopping
  // propagation preserves native input, IME, Tab navigation, and form submission.
  const stopPopupKeyPropagation = (event: KeyboardEvent) => {
    if (event.composedPath().includes(host)) event.stopImmediatePropagation();
  };
  window.addEventListener("keypress", stopPopupKeyPropagation, true);
  window.addEventListener("keyup", stopPopupKeyPropagation, true);
  window.addEventListener("keydown", event => {
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
      event.preventDefault(); event.stopImmediatePropagation(); close();
    } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && filtered.length) {
      event.preventDefault(); event.stopImmediatePropagation();
      active = (active + (event.key === "ArrowDown" ? 1 : -1) + filtered.length) % filtered.length;
      render();
    } else if (event.key === "Enter" && filtered.length && !event.shiftKey) {
      event.preventDefault(); event.stopImmediatePropagation(); choose(filtered[active]);
    }
  }, true);
  document.addEventListener("mousedown", event => {
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
