import fuzzysort from "../../vendor/fuzzysort";

function getCommandItems() {
  return [...document.querySelectorAll("[data-command-item][data-label]")].map(
    (el) => {
      const label = el.dataset.label;
      return { element: el, label };
    },
  );
}

function isCommandInputActive() {
  const activeElement = document.activeElement;
  return activeElement && activeElement.hasAttribute("data-command-input");
}

function selectFirstCommandItem() {
  const currentActiveItem = document.querySelector(
    "[data-command-item][data-active]",
  );

  const firstCommandItem = document.querySelector(
    "[data-command-item]:not(.hidden)",
  );

  if (firstCommandItem && currentActiveItem !== firstCommandItem) {
    if (currentActiveItem) {
      currentActiveItem.removeAttribute("data-active");
    }

    firstCommandItem.setAttribute("data-active", "true");
  }
}

function clickFirstCommandItemOnEnter(event) {
  if (event.key === "Enter") {
    // Only click on item when the command input is the active element
    /// Otherwise, this would run for every "Enter" key press on the page
    if (!isCommandInputActive()) {
      return;
    }

    const currentActiveItem = document.querySelector(
      "[data-command-item][data-active] a",
    );

    if (currentActiveItem) {
      currentActiveItem.click();
    }
  }
}

function searchItems(event, items) {
  const query = event.target.value.trim();
  const results = query ? fuzzysort.go(query, items, { key: "label" }) : [];
  const resultSet = new Set(results.map((r) => r.obj.element));

  items.forEach(({ element }) => {
    element.classList.toggle("hidden", query && !resultSet.has(element));
  });

  selectFirstCommandItem();
}

/**
 * Command search functionality for the command palette.
 *
 * ## Features
 *
 * - Fuzzy search for command items
 * - Keeps first item selected
 * - Clicks on the first item when Enter is pressed
 *
 * @example
 * ```heex
 * <input
 *   phx-hook="CommandSearch"
 *   data-command-input
 * />
 * ```
 */
export const CommandSearch = {
  mounted() {
    const items = getCommandItems();

    selectFirstCommandItem();

    this.el.addEventListener("input", (event) => searchItems(event, items));

    this.keydownHandler = clickFirstCommandItemOnEnter;
    window.addEventListener("keydown", this.keydownHandler);
  },
  destroyed() {
    window.removeEventListener("keydown", this.keydownHandler);
  },
};

/**
 * Keeps the first command item selected when the list is updated.
 * This is useful when updating results with server-side responses.
 */
export const CommandGroupList = {
  updated() {
    selectFirstCommandItem();
  },
};
