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
    this.clickFirstOptionHandler = () => {
      const first = this.el.querySelector('[role="option"] a');
      if (first) first.click();
    };

    this.el.addEventListener("clickFirstOption", this.clickFirstOptionHandler);
  },
  destroyed() {
    this.el.removeEventListener(
      "clickFirstOption",
      this.clickFirstOptionHandler,
    );
  },
};
