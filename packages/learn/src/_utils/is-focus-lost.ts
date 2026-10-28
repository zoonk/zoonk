/** A sheet counts: the dialog takes focus back when its focused control leaves. */
export function isFocusLost(active: Element | null): boolean {
  return (
    active === null ||
    active === document.body ||
    active.getAttribute("role") === "dialog" ||
    (active instanceof HTMLElement && !active.checkVisibility())
  );
}
