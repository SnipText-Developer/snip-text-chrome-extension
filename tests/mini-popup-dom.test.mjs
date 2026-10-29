import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const root = fileURLToPath(new URL("../packages/mini-popup/src/", import.meta.url));

test("mini-popup keeps imperative DOM access behind dom/index.ts", () => {
  function check(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === "dom") continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) { check(path); continue; }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const source = readFileSync(path, "utf8");
      const label = relative(root, path);
      assert.doesNotMatch(source, /\b(?:document|window)\s*\./, label + ": global DOM access");
      assert.doesNotMatch(source, /\.(?:querySelectorAll?|closest|getBoundingClientRect|focus|scrollIntoView|addEventListener|removeEventListener|preventDefault|stopPropagation)\s*\(/, label + ": direct DOM operation");
      assert.doesNotMatch(source, /from\s+["'][^"']*\/dom\/(?!index["'])/, label + ": internal DOM module import");
    }
  }
  check(root);
});


test("popup always stays below the cursor and limits its height to the remaining space", async () => {
  const { JSDOM } = await import("jsdom");
  const { moduleUrl } = await import("./module-url.mjs");
  const { positionPopup } = await import(moduleUrl("../packages/mini-popup/src/dom/popup.ts"));
  const dom = new JSDOM('<div id="host"><div id="popup"></div></div>');
  try {
    const host = dom.window.document.querySelector("#host");
    const popup = dom.window.document.querySelector("#popup");
    Object.defineProperties(popup, { offsetWidth: { value: 260 }, offsetHeight: { value: 200 } });
    // A partially collapsed animation must not affect the placement calculation.
    popup.getBoundingClientRect = () => ({ width: 10, height: 5 });
    positionPopup(host, popup, { left: 100, top: 700, bottom: 720 });
    assert.equal(host.style.top, "726px");
    assert.equal(host.style.getPropertyValue("--genie-x"), "0px");
    assert.equal(host.style.getPropertyValue("--genie-y"), "-6px");
    assert.equal(host.style.getPropertyValue("--popup-available-height"), "34px");
    positionPopup(host, popup, { left: 100, top: 100, bottom: 120 });
    assert.equal(host.style.top, "126px");
    assert.equal(host.style.getPropertyValue("--popup-available-height"), "634px");
    positionPopup(host, popup, { left: 2, top: 100, bottom: 120 });
    assert.equal(host.style.getPropertyValue("--genie-x"), "-6px", "Viewport padding must not shift the cursor anchor");
    positionPopup(host, popup, { left: 1000, top: 100, bottom: 120 });
    assert.equal(parseFloat(host.style.left) + parseFloat(host.style.getPropertyValue("--genie-x")), 1000);
  } finally {
    dom.window.close();
  }
});

test("popup anchor follows the caret end rather than the slash start", async () => {
  const { JSDOM } = await import("jsdom");
  const { moduleUrl } = await import("./module-url.mjs");
  const { createEditorDom } = await import(moduleUrl("../packages/mini-popup/src/dom/editor.ts"));
  const dom = new JSDOM('<div id="editor" contenteditable="true" tabindex="0">/template</div>');
  const previousNode = globalThis.Node;
  const previousNodeFilter = globalThis.NodeFilter;
  globalThis.Node = dom.window.Node;
  globalThis.NodeFilter = dom.window.NodeFilter;
  try {
    const { document } = dom.window;
    const editor = document.querySelector("#editor");
    editor.focus();
    const caret = document.createRange();
    caret.selectNodeContents(editor);
    caret.collapse(false);
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(caret);
    dom.window.Range.prototype.getBoundingClientRect = function () {
      return { left: this.collapsed ? 200 : 100, top: 100, bottom: 120, height: 20 };
    };
    const adapter = createEditorDom("#editor", document);
    assert.ok(adapter.findTrigger());
    assert.equal(adapter.getBounds().left, 200);
  } finally {
    globalThis.Node = previousNode;
    globalThis.NodeFilter = previousNodeFilter;
    dom.window.close();
  }
});
