import { type AppRoute } from "@/i18n/navigation";
import { GenerationShortcutLink } from "./generation-shortcut-link";

const generationExitLinkWidths = { content: "w-fit max-w-full self-start", full: "w-full" };

type GenerationExitLinkWidth = keyof typeof generationExitLinkWidths;

/**
 * Gives learners a quiet way out of generated-content waiting states. The
 * width variant keeps page-level exit actions compact while preserving the
 * full-width action layout used by empty states.
 */
export function GenerationExitLink<Href extends string>({
  children,
  href,
  shortcut,
  width = "full",
}: {
  children: React.ReactNode;
  href: AppRoute<Href>;
  shortcut?: "Esc";
  width?: GenerationExitLinkWidth;
}) {
  return (
    <GenerationShortcutLink
      className={generationExitLinkWidths[width]}
      href={href}
      prefetch
      shortcut={shortcut}
    >
      {children}
    </GenerationShortcutLink>
  );
}
