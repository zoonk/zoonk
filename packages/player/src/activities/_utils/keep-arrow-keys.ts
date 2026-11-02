export function keepArrowKeys(event: React.KeyboardEvent): void {
  if (event.key.startsWith("Arrow")) {
    event.stopPropagation();
  }
}
