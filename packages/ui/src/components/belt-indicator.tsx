import { cn } from "@zoonk/ui/lib/utils";
import { type BeltColor } from "@zoonk/utils/belt-level";

const beltColorClasses: Record<BeltColor, string> = {
  black: "bg-belt-black",
  blue: "bg-belt-blue",
  brown: "bg-belt-brown",
  gray: "bg-belt-gray",
  green: "bg-belt-green",
  orange: "bg-belt-orange",
  purple: "bg-belt-purple",
  red: "bg-belt-red",
  white: "bg-belt-white",
  yellow: "bg-belt-yellow",
};

function BeltIndicator({
  className,
  color,
  label,
  size = "md",
  ...props
}: Omit<React.ComponentProps<"span">, "color"> & {
  color: BeltColor;
  label: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses: Record<typeof size, string> = {
    lg: "size-6",
    md: "size-4",
    sm: "size-3",
  };

  return (
    <span
      aria-label={label}
      className={cn(
        "inline-block shrink-0 rounded-full transition-colors duration-500",
        "ring-1 ring-black/10 ring-inset dark:ring-white/10",
        beltColorClasses[color],
        sizeClasses[size],
        className,
      )}
      role="img"
      {...props}
    />
  );
}

export { BeltIndicator };
