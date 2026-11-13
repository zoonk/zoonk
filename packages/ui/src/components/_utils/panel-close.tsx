import { Button } from "@zoonk/ui/components/button";
import { XIcon } from "lucide-react";

/** The ✕ of a sheet, a dialog and a side panel: one size, its ink on the panel's edge. */
export function PanelCloseButton({
  label,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "children"> & { label: string }) {
  return (
    <Button
      className="-my-1 shrink-0 [--icon-size:--spacing(5)]"
      edge="end"
      size="icon-sm"
      variant="ghost"
      {...props}
    >
      <XIcon aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
