/** Whether focus is on the page itself or a control hidden with the screen it left. */
export function isFocusLost(active: Element | null): boolean {
  return (
    active === null ||
    active === document.body ||
    (active instanceof HTMLElement && !active.checkVisibility())
  );
}
