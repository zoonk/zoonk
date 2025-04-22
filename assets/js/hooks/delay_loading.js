/**
 * A hook that removes the `hidden` class from an element after a specified delay.
 * This is useful for creating smooth transitions or delayed reveals of elements.
 *
 * Usage:
 * ```
 * <div phx-hook="DelayLoading" class="hidden">Content to show after delay</div>
 * ```
 *
 * You can also specify a custom delay using the data-delay attribute:
 * ```
 * <div phx-hook="DelayLoading" data-delay="500" class="hidden">Content with custom delay</div>
 * ```
 */
export const DelayLoading = {
  mounted() {
    // Get custom delay from data attribute or use default of 300ms
    const delay = this.el.dataset.delay ? parseInt(this.el.dataset.delay) : 300;

    // Start fully transparent but visible
    this.el.classList.add("opacity-0", "transition-opacity", "duration-300");

    requestAnimationFrame(() => {
      this.delayTimeout = setTimeout(() => {
        this.el.classList.add("opacity-100");
      }, delay);
    });
  },

  destroyed() {
    // Clean up timeout if the element is removed before the delay completes
    if (this.delayTimeout) {
      clearTimeout(this.delayTimeout);
    }
  },
};
