import { Button } from "@zoonk/ui/components/button";

/** A step's quiet way around what it asks ("I can't talk now"), on the column's edge under the step. */
export function StepWayOut({
  children,
  icon,
  label,
  onClick,
}: {
  children: string;
  icon?: React.ReactNode;
  label?: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={label}
      className="w-fit"
      data-slot="step-way-out"
      edge="start"
      onClick={onClick}
      size="sm"
      type="button"
      variant="ghost"
    >
      {icon}
      {children}
    </Button>
  );
}
