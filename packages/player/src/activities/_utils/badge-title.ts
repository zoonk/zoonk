function plain(text: string): string {
  return text.trim().toLocaleLowerCase();
}

/** A chip whose words open the title under it says the same thing twice, so the title says it alone. */
export function opensTitle({ label, title }: { label: string; title: string }): boolean {
  return plain(label) !== "" && plain(title).startsWith(plain(label));
}
