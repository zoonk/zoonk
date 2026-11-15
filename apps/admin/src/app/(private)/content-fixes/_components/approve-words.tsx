import { cn } from "@zoonk/ui/lib/utils";

export const ADD_PASSKEY = "Add a passkey to approve";

/**
 * The approve control's words. It says one of two things, by whether the viewer has a passkey,
 * which the page learns as it loads: both sit centered in one cell and only `shown` is visible, so the
 * control is as wide as the longer one in every state and nothing beside it moves when it lands.
 */
export function ApproveWords({ approveLabel, shown }: { approveLabel: string; shown: string }) {
  return (
    <span className="inline-grid justify-items-center">
      {[approveLabel, ADD_PASSKEY].map((label) => (
        <span
          aria-hidden={label === shown ? undefined : true}
          className={cn("col-start-1 row-start-1", label !== shown && "invisible")}
          key={label}
        >
          {label}
        </span>
      ))}
    </span>
  );
}
