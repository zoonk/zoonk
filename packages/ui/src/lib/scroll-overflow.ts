export function canScrollAlong(element: Element, axis: "x" | "y"): boolean {
  const { overflowX, overflowY } = getComputedStyle(element);
  const overflow = axis === "x" ? overflowX : overflowY;

  const hidden =
    axis === "x"
      ? element.scrollWidth - element.clientWidth
      : element.scrollHeight - element.clientHeight;

  return (overflow === "auto" || overflow === "scroll") && hidden > 0;
}
