import { CHARACTER_SIZES } from "@/design-system/characters";
import { Buddy } from "@zoonk/ui/components/buddy";
import { Trickster } from "@zoonk/ui/components/trickster";
import { Specimen } from "../../_components/doc";

export const SPECIMEN_ENERGY = 70;

/** Each picture has a hairline around it here, to show that nothing of the character passes it. */
const FRAME = "ring-border ring-1 ring-inset";

export function SizeSpecimen() {
  return (
    <Specimen className="flex flex-wrap items-end gap-x-8 gap-y-6">
      {CHARACTER_SIZES.map(({ className, size, view }) => (
        <figure className="flex flex-col items-start gap-2" key={className}>
          <div className="flex items-end gap-3">
            <Buddy
              beltColor="orange"
              className={`${className} ${FRAME}`}
              energy={SPECIMEN_ENERGY}
              kind="zu"
              studiedToday
              view={view}
            />
            <Trickster className={`${className} ${FRAME}`} view={view} />
          </div>
          <figcaption className="text-muted-foreground font-mono text-xs">
            {size} · {view}
          </figcaption>
        </figure>
      ))}
    </Specimen>
  );
}
