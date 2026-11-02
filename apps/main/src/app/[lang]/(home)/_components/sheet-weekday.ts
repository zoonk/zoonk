export function toSheetWeekday({ locale, weekday }: { locale: string; weekday: string }): string {
  const bare = weekday.replace(/\.$/u, "");
  return bare.charAt(0).toLocaleUpperCase(locale) + bare.slice(1);
}
