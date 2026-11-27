import { cn } from "@zoonk/ui/lib/utils";
import { TITLE_ROW_CLASS, TRUNCATED_TITLE_CLASS } from "../_components/title-row";

/** Alone, the name's line is the face's 32px, so the name sits level with the face. */
export const BUDDY_NAME_CLASS = cn(
  TRUNCATED_TITLE_CLASS,
  "text-sm leading-8 font-semibold in-data-described:leading-5",
);

/**
 * Who the learner is talking to, drawn the same wherever the buddy's chat opens: its page and the
 * sheet over a lesson. `title` is the host's own heading wearing `BUDDY_NAME_CLASS`; `children` sit
 * beside the name while they fit; `description` goes under the name, the pair centered on the face;
 * `menu` stays at the end.
 */
export function BuddyIdentityRow({
  children,
  description,
  face,
  menu,
  title,
}: {
  children?: React.ReactNode;
  description?: React.ReactNode;
  face: React.ReactNode;
  menu?: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <div
      className={cn("flex gap-2.5", description ? "items-center" : "items-start")}
      data-described={description ? "" : undefined}
      data-slot="buddy-identity-row"
    >
      {face}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className={cn(TITLE_ROW_CLASS, "gap-x-2.5 gap-y-1")}>
          {title}
          {children}
        </div>
        {description}
      </div>
      {menu}
    </div>
  );
}
