// Stands in for Main's `@/i18n/navigation`: the page being shown sets its path.
export function usePathname(): string {
  return (globalThis as any).__BUDDY_PATH ?? "/level";
}
