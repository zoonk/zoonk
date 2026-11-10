import { type Page } from "@playwright/test";

/**
 * What Chrome's page translator does to the DOM: it merges adjacent text, splits numbers off, swaps
 * each text node for nested `<font>` wrappers holding the translation, and keeps translating
 * whatever the page renders next. Like Chrome's, it runs in an isolated world, so the page's own
 * scripts never see its DOM calls. Translations read as `[text]`.
 */
const TRANSLATOR = `(() => {
  const owned = new WeakSet();

  const isText = (node) => node.nodeType === Node.TEXT_NODE;
  const hasWords = (node) => /\\S/u.test(node.nodeValue ?? "");

  function isSkipped(node) {
    const start = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    for (let element = start; element; element = element.parentElement) {
      if (["FONT", "NOSCRIPT", "SCRIPT", "STYLE"].includes(element.tagName)) return true;
      if (element.getAttribute("translate") === "no") return true;
    }
    return false;
  }

  function wrap(text) {
    const outer = document.createElement("font");
    const inner = document.createElement("font");
    outer.setAttribute("style", "vertical-align: inherit;");
    inner.setAttribute("style", "vertical-align: inherit;");
    const translated = document.createTextNode("[" + text + "]");
    owned.add(translated);
    inner.appendChild(translated);
    outer.appendChild(inner);
    return outer;
  }

  function mergeAdjacentText(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let element = root; element; element = walker.nextNode()) {
      for (let child = element.firstChild; child; child = child.nextSibling) {
        while (isText(child) && child.nextSibling && isText(child.nextSibling)) {
          child.nodeValue += child.nextSibling.nodeValue;
          element.removeChild(child.nextSibling);
        }
      }
    }
  }

  function translate(root) {
    if (!root.isConnected || root.nodeType !== Node.ELEMENT_NODE || isSkipped(root)) return;
    mergeAdjacentText(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const pending = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (hasWords(node) && !owned.has(node) && !isSkipped(node)) pending.push(node);
    }
    for (const node of pending) {
      const parent = node.parentNode;
      for (const segment of node.nodeValue.split(/(\\d+)/u).filter(Boolean)) {
        parent.insertBefore(wrap(segment), node);
      }
      parent.removeChild(node);
    }
  }

  document.documentElement.classList.add("translated-ltr");
  translate(document.body);

  new MutationObserver((records) => {
    const roots = new Set();
    for (const record of records) {
      if (record.type === "characterData") {
        if (!owned.has(record.target) && record.target.parentElement) roots.add(record.target.parentElement);
        continue;
      }
      for (const added of record.addedNodes) {
        if (owned.has(added)) continue;
        roots.add(isText(added) ? added.parentElement : added);
      }
    }
    for (const root of roots) if (root) translate(root);
  }).observe(document.body, { characterData: true, childList: true, subtree: true });
})();`;

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

/** The translator splits numbers off into their own wrappers, so text a test reads back has none. */
export function lettersOnly(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export async function translatePage(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const { frameTree } = await cdp.send("Page.getFrameTree");

  const { executionContextId } = await cdp.send("Page.createIsolatedWorld", {
    frameId: frameTree.frame.id,
    worldName: "page-translator",
  });

  await cdp.send("Runtime.evaluate", { contextId: executionContextId, expression: TRANSLATOR });
}
