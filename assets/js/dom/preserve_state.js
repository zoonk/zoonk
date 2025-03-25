/**
 * Controls `<details>` and `<dialog>` state on the client
 * when LiveView updates the DOM.
 *
 * This prevents the LiveView from removing their
 * attributes, which would cause them to close while
 * typing, for example.
 *
 * ---
 *
 * Inspired and derived from
 * - https://github.com/phoenixframework/phoenix_live_view/issues/2349
 * - https://elixirforum.com/t/weird-liveview-behavior-with-native-dialog-element/64705/2
 *
 * @param {HTMLElement} fromEl
 * @param {HTMLElement} toEl
 */
export function preserveAttrsFromElement(fromEl, toEl) {
  if (fromEl.tagName !== "DIALOG" && fromEl.tagName !== "DETAILS") {
    return true;
  }

  Array.from(fromEl.attributes).forEach((attr) => {
    toEl.setAttribute(attr.name, attr.value);
  });

  // prevent the DOM update for dialog and details
  // to avoid nuking the dialog state
  return false;
}
