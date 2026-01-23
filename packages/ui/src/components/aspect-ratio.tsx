import { cn } from "@zoonk/ui/lib/utils";
import type { CSSPropertiesWithVariables } from "@zoonk/ui/lib/css-variables";

function AspectRatio({
  ratio,
  className,
  ...props
}: React.ComponentProps<"div"> & { ratio: number }) {
  const style: CSSPropertiesWithVariables = { "--ratio": ratio };

  return (
    <div
      className={cn("relative aspect-(--ratio)", className)}
      data-slot="aspect-ratio"
      style={style}
      {...props}
    />
  );
}

export { AspectRatio };
