export const BAR_GLYPH_ACTION = {
  className: "max-sm:w-full max-sm:justify-start",
  size: "bar",
} as const;

export function BarActionLabel({ children }: { children: React.ReactNode }) {
  return <span>{children}</span>;
}
