function isCommandInputActive() {
  const activeElement = document.activeElement;
  return activeElement && activeElement.hasAttribute("data-command-input");
}

/**
 * Clicks the first option in a list when the event is triggered.
 *
 * @example
 * ```heex
 * <ul
 *  phx-hook="ClickFirstOption"
 *  phx-window-keydown={JS.dispatch("clickFirstOption")}
 *  phx-key="enter"
 * >
 *   <li role="option"><a href="#">Option 1</a></li>
 *   <li role="option"><a href="#">Option 2</a></li>
 * </ul>
 * ```
 */
export const ClickFirstOption = {
  mounted() {
    this.el.addEventListener("clickFirstOption", () => {
      if (!isCommandInputActive()) {
        return;
      }

      const first = this.el.querySelector('[role="option"] a');
      if (first) first.click();
    });
  },
};
