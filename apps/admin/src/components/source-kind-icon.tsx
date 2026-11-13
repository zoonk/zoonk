import { type SourceKind } from "@zoonk/db/enums";
import { cn } from "@zoonk/ui/lib/utils";
import { FileUpIcon, GlobeIcon, LandmarkIcon, type LucideIcon } from "lucide-react";

/** Who a source comes from: the body that runs the exam, another site, or a learner's own file. */
const SOURCE_KIND_ICONS: Record<SourceKind, LucideIcon> = {
  official: LandmarkIcon,
  secondary: GlobeIcon,
  upload: FileUpIcon,
};

export function SourceKindIcon({ className, kind }: { className?: string; kind: SourceKind }) {
  const Icon = SOURCE_KIND_ICONS[kind];

  return (
    <Icon aria-hidden="true" className={cn("text-muted-foreground size-4 shrink-0", className)} />
  );
}
