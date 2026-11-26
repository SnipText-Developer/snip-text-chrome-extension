import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const root = fileURLToPath(new URL("../packages/mini-popup/src/", import.meta.url));

test("mini-popup keeps imperative DOM access in the entry point and designated hooks", () => {
  function check(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) { check(path); continue; }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const source = readFileSync(path, "utf8");
      const label = relative(root, path);
      if (label !== "index.tsx") {
        assert.doesNotMatch(source, /\b(?:document|window)\s*\./, label + ": global DOM access");
      }
      const allowedOperations = {
        "index.tsx": /\.querySelectorAll\s*\(/g,
        "hooks/editor/editor-anchor.ts": /\.(?:closest|getBoundingClientRect)\s*\(/g,
        "hooks/editor/useEditorAnchor.ts": /\.(?:closest|focus)\s*\(/g,
        "hooks/editor/useEditorEvents.ts": /\.addEventListener\s*\(/g,
        "hooks/popup/usePopupPosition.ts": /\.(?:addEventListener|removeEventListener)\s*\(/g,
        "hooks/popup/usePopupEventIsolation.ts": /\.(?:addEventListener|closest|preventDefault|stop(?:Immediate)?Propagation)\s*\(/g,
        "hooks/template/useTemplateVariables.ts": /\.preventDefault\s*\(/g,
      }[label];
      const checkedSource = allowedOperations ? source.replace(allowedOperations, "(") : source;
      assert.doesNotMatch(checkedSource, /\.(?:querySelectorAll?|closest|getBoundingClientRect|focus|scrollIntoView|addEventListener|removeEventListener|preventDefault|stop(?:Immediate)?Propagation)\s*\(/, label + ": direct DOM operation");
    }
  }
  check(root);
});


test("popup always stays below the cursor and limits its height to the remaining space", async () => {
  const { moduleUrl } = await import("./module-url.mjs");
  const { calculatePopupPosition } = await import(moduleUrl("../packages/mini-popup/src/utils/popup-position.ts"));
  const measure = (left, bottom) => calculatePopupPosition({ left, bottom }, 260, 1024, 768);
  let position = measure(100, 720);
  assert.equal(position.top, 726);
  assert.equal(position["--genie-x"], "0px");
  assert.equal(position["--genie-y"], "-6px");
  assert.equal(position["--popup-available-height"], "34px");
  position = measure(100, 120);
  assert.equal(position.top, 126);
  assert.equal(position["--popup-available-height"], "634px");
  position = measure(2, 120);
  assert.equal(position["--genie-x"], "-6px", "Viewport padding must not shift the cursor anchor");
  position = measure(1000, 120);
  assert.equal(position.left + parseFloat(position["--genie-x"]), 1000);
});

test("popup anchor follows the caret end rather than the backslash start", async () => {
  const { JSDOM } = await import("jsdom");
  const { moduleUrl } = await import("./module-url.mjs");
  const { findEditorAnchor, getEditorAnchorBounds } = await import(moduleUrl("../packages/mini-popup/src/hooks/editor/editor-anchor.ts"));
  const dom = new JSDOM('<div id="editor" contenteditable="true" tabindex="0">\\template</div>');
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
    const anchor = findEditorAnchor("#editor", false, document);
    assert.ok(anchor);
    assert.equal(getEditorAnchorBounds(anchor).left, 200);
  } finally {
    globalThis.Node = previousNode;
    globalThis.NodeFilter = previousNodeFilter;
    dom.window.close();
  }
});
