import { TabNav } from "./tab-nav";

const LINKS = [
  { href: "/design", id: "design", label: "Design system" },
  { href: "/", id: "player", label: "Player" },
] as const;

export function SiteNav({ current }: { current: (typeof LINKS)[number]["id"] }) {
  return (
    <TabNav
      label="Playground"
      options={LINKS.map((link) => ({ ...link, isActive: link.id === current }))}
    />
  );
}
