import { Trickster } from "@zoonk/ui/components/trickster";
import { cn } from "@zoonk/ui/lib/utils";

/** The Trickster as a challenge's art: beaten, he leans back; otherwise he still holds his sign. */
export function TricksterArt({ beaten = false }: { beaten?: boolean }) {
  return (
    <Trickster
      className={cn("size-28 sm:size-32", beaten && "rotate-12 opacity-80")}
      pose={beaten ? "sly" : "hero"}
    />
  );
}
