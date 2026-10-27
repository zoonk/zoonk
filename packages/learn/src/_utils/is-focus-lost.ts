/**
 * Whether focus is on the page itself, on a sheet (the dialog takes focus back when its focused
 * control leaves), or on a control hidden with the screen it left.
 */
export function isFocusLost(active: Element | null): boolean {
  return (
    active === null ||
    active === document.body ||
    active.getAttribute("role") === "dialog" ||
    (active instanceof HTMLElement && !active.checkVisibility())
  );
}
