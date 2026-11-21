// Stands in for Main's `@/i18n/navigation`: the page being shown sets its path.
declare global {
  var __BUDDY_PATH: string | undefined;
}

export function usePathname(): string {
  return globalThis.__BUDDY_PATH ?? "/level";
}
