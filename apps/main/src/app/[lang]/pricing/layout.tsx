/** The pricing page and each currency's variant (`pricing/<currency>`) are fully static. */
export const ensureStatic = "navigation";

export default function PricingLayout({ children }: LayoutProps<"/[lang]/pricing">) {
  return children;
}
