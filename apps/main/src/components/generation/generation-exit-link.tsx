import { type Route } from "next";
import { GenerationShortcutLink } from "./generation-shortcut-link";

/**
 * Gives learners a quiet way out of generated-content waiting states. Keeping
 * this wrapper small lets generation screens opt into keyboard shortcuts
 * without duplicating button styling at each call site.
 */
export function GenerationExitLink<Href extends string>({
  children,
  href,
  shortcut,
}: {
  children: React.ReactNode;
  href: Route<Href>;
  shortcut?: "Esc";
}) {
  return (
    <GenerationShortcutLink href={href} prefetch shortcut={shortcut}>
      {children}
    </GenerationShortcutLink>
  );
}
