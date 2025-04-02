/**
 * Handles the scrolling effect for tab bars on tablet screens.
 *
 * This hook detects when the user scrolls the page and applies
 * different styles to the tab bar to create an iPadOS-like effect,
 * where the tab bar becomes translucent and full width when scrolling.
 *
 * @example
 * ```heex
 * <.tab_bar phx-hook="TabBarScroll">
 *   <!-- tab items -->
 * </.tab_bar>
 * ```
 */
export const TabBarScroll = {
  mounted() {
    // Initial state - not scrolled
    this.el.dataset.scrolled = "false";

    // Track scroll position
    let lastScrollY = window.scrollY;

    // Update tab bar state based on scroll position
    const updateTabBarState = () => {
      // Consider the page scrolled if we're more than 20px from the top
      const isScrolled = window.scrollY > 20;

      // Only update the DOM if the state changed
      if (this.el.dataset.scrolled !== String(isScrolled)) {
        this.el.dataset.scrolled = String(isScrolled);
      }

      lastScrollY = window.scrollY;
    };

    // Initialize on mount
    updateTabBarState();

    // Add scroll listener
    this.scrollListener = () => {
      window.requestAnimationFrame(updateTabBarState);
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
