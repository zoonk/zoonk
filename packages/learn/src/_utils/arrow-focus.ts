/**
 * Left and right arrows move focus between the elements with this `data-slot` inside the
 * container, so a row of buttons takes one tab stop: give only one of them `tabIndex={0}`.
 */
export function moveFocusWithArrows(slot: string) {
  return (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
      return;
    }

    const items = [...event.currentTarget.querySelectorAll(`[data-slot="${slot}"]`)];
    const active = document.activeElement;
    const index = active ? items.indexOf(active) : -1;

    if (index === -1) {
      return;
    }

    event.preventDefault();
    const next = event.key === "ArrowRight" ? index + 1 : index - 1;
    const item = items[Math.min(items.length - 1, Math.max(0, next))];

    if (item instanceof HTMLElement) {
      item.focus();
    }
  };
}
