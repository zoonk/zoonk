/** A graded answer can keep keyboard focus, so its verdict's border wins over the focus border. */
export const ANSWER_GROUP_CLASS =
  "bg-background data-[result=correct]:border-success data-[result=wrong]:border-destructive data-[result=correct]:has-[[data-slot=input-group-control]:focus-visible]:border-success data-[result=wrong]:has-[[data-slot=input-group-control]:focus-visible]:border-destructive h-14 rounded-lg";

/**
 * Call as an answer is sent: an on-screen keyboard would cover the verdict, so it closes, while a
 * physical one stays in the field.
 */
export function putAwayOnScreenKeyboard(): void {
  if (
    !globalThis.matchMedia("(pointer: fine)").matches &&
    document.activeElement instanceof HTMLElement
  ) {
    document.activeElement.blur();
  }
}
