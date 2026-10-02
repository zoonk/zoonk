import { cn } from "@zoonk/ui/lib/utils";

/** Moons take the accent tokens in turn, so every phase keeps its color in both themes. */
const MOON_TONES = [
  "bg-fun-accent-cyan",
  "bg-fun-accent-violet",
  "bg-fun-accent-orange",
  "bg-fun-accent-pink",
  "bg-fun-accent-lime",
  "bg-fun-accent-amber",
] as const;

/** A phase drawn as a moon: a soft sphere lit from the top left. */
export function FunMoon({ index, size = "md" }: { index: number; size?: "lg" | "md" | "sm" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative block shrink-0 rounded-full shadow-[inset_-6px_-8px_14px_rgb(0_0_0/0.28)]",
        "after:absolute after:inset-0 after:rounded-full after:bg-[radial-gradient(circle_at_32%_28%,rgb(255_255_255/0.55),transparent_58%)]",
        MOON_TONES[index % MOON_TONES.length],
        size === "sm" && "size-6",
        size === "md" && "size-9",
        size === "lg" &&
          "size-16 shadow-[0_0_32px_rgb(124_245_255/0.45),inset_-8px_-10px_18px_rgb(0_0_0/0.28)]",
      )}
    />
  );
}
