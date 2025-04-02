/**
 * Handles the scrolling effect for toolbars on tablet screens.
 *
 * This hook detects when the user scrolls the page and applies
 * different styles to the toolbar to create an iPadOS-like effect,
 * where the toolbar becomes translucent and full width when scrolling.
 *
 * @example
 * ```heex
 * <.tab_bar phx-hook="ToolbarScroll">
 *   <!-- tab items -->
 * </.tab_bar>
 * ```
 */
export const ToolbarScroll = {
  mounted() {
    // Initial state - not scrolled
    this.el.dataset.scrolled = "false";

    // Track scroll position
    let lastScrollY = window.scrollY;

    // Update toolbar state based on scroll position
    const updateToolbarState = () => {
      // Consider the page scrolled if we're more than 20px from the top
      const isScrolled = window.scrollY > 20;

      // Only update the DOM if the state changed
      if (this.el.dataset.scrolled !== String(isScrolled)) {
        this.el.dataset.scrolled = String(isScrolled);
      }

      lastScrollY = window.scrollY;
    };

    // Initialize on mount
    updateToolbarState();

    // Add scroll listener
    this.scrollListener = () => {
      window.requestAnimationFrame(updateToolbarState);
    };

    window.addEventListener("scroll", this.scrollListener, { passive: true });
  },

  destroyed() {
    // Clean up scroll listener when component is removed
    if (this.scrollListener) {
      window.removeEventListener("scroll", this.scrollListener);
    }
  },
};
