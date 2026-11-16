import { Button } from "@zoonk/ui/components/button";

/** A step's quiet way around what it asks ("I can't talk now"), on the column's edge under the step. */
export function StepWayOut({
  children,
  icon,
  onClick,
}: {
  children: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
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
