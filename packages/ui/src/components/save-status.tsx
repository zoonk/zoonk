import { cn } from "@zoonk/ui/lib/utils";
import type * as React from "react";

export type SaveStatusType = "idle" | "unsaved" | "saving" | "saved" | "fading";

export type SaveStatusLabels = {
  unsaved: React.ReactNode;
  saving: React.ReactNode;
  saved: React.ReactNode;
};

export type SaveStatusProps = React.ComponentProps<"span"> & {
  status: SaveStatusType;
  labels: SaveStatusLabels;
};

function SaveStatus({ status, labels, className, ...props }: SaveStatusProps) {
  if (status === "idle") {
    return null;
  }

  return (
    <span
      aria-live="polite"
      className={cn(
        "text-muted-foreground/60 text-xs",
        "transition-opacity duration-500",
        status === "fading" && "opacity-0",
        className,
      )}
      data-slot="save-status"
      data-status={status}
      {...props}
    >
      {status === "unsaved" && labels.unsaved}
      {status === "saving" && labels.saving}
      {(status === "saved" || status === "fading") && labels.saved}
    </span>
  );
}

function combineSaveStatuses(...statuses: SaveStatusType[]): SaveStatusType {
  if (statuses.some((status) => status === "saving")) {
    return "saving";
  }

  if (statuses.some((status) => status === "unsaved")) {
    return "unsaved";
  }

  if (statuses.some((status) => status === "saved")) {
    return "saved";
  }

  if (statuses.some((status) => status === "fading")) {
    return "fading";
  }

  return "idle";
}

export { combineSaveStatuses, SaveStatus };
