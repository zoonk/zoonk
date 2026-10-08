import { LineMarker } from "@zoonk/ui/components/line-marker";
import { ChevronDownIcon } from "lucide-react";
import { type ReactNode } from "react";

/**
 * Detail that can wait, one tap away: a native `<details>`, so what it holds stays in the page's
 * HTML for search engines and works before scripts load. `aside` says how much is inside. A line
 * only separates one disclosure from the next, never frames a list, so a group stays quiet.
 */
export function PublicDisclosure({
  aside,
  children,
  summary,
}: {
  aside?: ReactNode;
  children: ReactNode;
  summary: ReactNode;
}) {
  return (
    <details className="group not-first:border-t">
      {/* The aside and the chevron stay on the summary's first line when it wraps. */}
      <summary className="hover:text-foreground focus-visible:ring-ring/50 flex cursor-pointer list-none gap-4 rounded-md py-4 text-[15px] leading-snug font-semibold outline-none select-none focus-visible:ring-[3px] sm:text-base [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <span className="text-pretty">{summary}</span>

          {aside && (
            <span className="text-muted-foreground flex-none text-[13px] font-normal tabular-nums sm:text-sm">
              {aside}
            </span>
          )}
        </span>

        <LineMarker>
          <ChevronDownIcon
            aria-hidden="true"
            className="text-muted-foreground size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </LineMarker>
      </summary>

      <div className="pb-6">{children}</div>
    </details>
  );
}
