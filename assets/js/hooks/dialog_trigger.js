/**
 * Get the dialog element by id.
 *
 * If no id is provided, it will return the first dialog element on the page.
 *
 * @param {*} id The id of the dialog element to be opened.
 * @returns {HTMLElement} The dialog element.
 */
function getDialog(id) {
  const selector = id ? `dialog#${id}` : "dialog";
  return document.querySelector(selector);
}

function openDialog(el) {
  el.showModal();
}

/**
 * Handles the keyboard shortcut for opening the dialog.
 *
 * Shortcuts are defined in the `data-shortcut` attribute of the trigger element.
 * For example, if the trigger element has `data-shortcut="p"`, then
 * the dialog will be opened when the user presses `cmd+p` or `ctrl+p`.
 * If no shortcut is defined, it will default to `k`.
 */
function handleShortcut(event, dialog) {
  const shortcut = this.el.dataset.shortcut || "k";

  if (event.key === shortcut && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    openDialog(dialog);
  }
}

/**
 * Handles opening and closing of dialogs.
 *
 * This hook listens for clicks on the trigger element and
 * keyboard shortcuts to open the dialog.
 *
 * It also listens for the `closeDialog` event to close the dialog.
 * You can use it in combination with the `phx-click-away` directive
 * to close the dialog when clicking outside the dialog.
 *
 * @example
 * ```heex
 * <dialog id="my-dialog" phx-hook="DialogTrigger">
 *   <.focus_wrap phx-click-away={JS.dispatch("closeDialog")}></.focus_wrap>
 * </dialog>
 * ```
 */
export const DialogTrigger = {
  mounted() {
    const dialog = getDialog(this.el.dataset.dialogId);

    // Open the dialog when the trigger is clicked
    this.el.addEventListener("click", openDialog.bind(this, dialog));

    // Also open the dialog when the shortcut is pressed, e.g. "cmd+k"
    document.addEventListener("keydown", (event) =>
      handleShortcut.call(this, event, dialog),
    );

    // Close the dialog when receiving the "closeDialog" event
    dialog.addEventListener("closeDialog", (event) => {
      dialog.close();
    });
  },
};
