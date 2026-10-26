import { MEASURES, RADII, SHAPE_RULES } from "@/design-system/shape";
import { kindFillClass } from "@zoonk/learn/kind-tile";
import { MeterPart, MeterParts } from "@zoonk/learn/meter";
import { Surface } from "@zoonk/learn/surface";
import { cn } from "@zoonk/ui/lib/utils";
import { type Metadata } from "next";
import { DocHeader, DocRules, DocSection, Specimen, renderCode } from "../_components/doc";

export const metadata: Metadata = { title: "Spacing and shape" };

export default function ShapePage() {
  return (
    <>
      <DocHeader title="Spacing and shape">
        A 4px grid, a few radii with one job each, measures for what has to stay readable, and no
        shadows on content.
      </DocHeader>

      <DocSection title="Rules">
        <DocRules rules={SHAPE_RULES} />
      </DocSection>

      <DocSection title="Radius">
        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {RADII.map((radius) => (
            <div className="flex flex-col gap-2" key={radius.name}>
              <div className={cn("bg-muted ring-input h-16 ring-1 ring-inset", radius.className)} />
              <p className="text-sm font-medium">{radius.name}</p>
              <code className="text-muted-foreground font-mono text-xs">{radius.className}</code>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {renderCode(radius.use)}
              </p>
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection title="Measures">
        <div className="flex flex-col gap-3">
          {MEASURES.map((measure) => (
            <div className="flex flex-col gap-1" key={measure.name}>
              <div className={cn("bg-surface-3 h-2 w-full rounded-[3px]", measure.className)} />
              <p className="text-sm">
                <span className="font-medium">{measure.name}</span>{" "}
                <code className="text-muted-foreground font-mono text-xs">{measure.className}</code>
              </p>
              <p className="text-muted-foreground text-xs">{renderCode(measure.use)}</p>
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection
        intro="Content is flat: a panel reads by its tone and one hairline. Only overlays cast a shadow."
        title="Elevation"
      >
        <Specimen className="bg-ground grid gap-4 sm:grid-cols-2">
          <Surface className="p-4 text-sm">A panel: card, one hairline, no shadow.</Surface>
          <div className="bg-popover ring-foreground/10 rounded-xl p-4 text-sm shadow-[0_16px_48px_-12px_rgb(0_0_0/0.35)] ring-1">
            An overlay: a menu, the palette, a sheet.
          </div>
        </Specimen>
      </DocSection>

      <DocSection
        intro="A meter's parts are sized by what they measure and colored by what they are."
        title="Meters"
      >
        <Specimen className="flex flex-col gap-4">
          <MeterParts>
            <MeterPart className="bg-success" weight={2} />
            <MeterPart
              className="ring-selected bg-transparent ring-[1.5px] ring-inset"
              weight={5}
            />
            <MeterPart weight={5} />
            <MeterPart weight={3} />
            <MeterPart className={kindFillClass("practice")} weight={6} />
          </MeterParts>
          <MeterParts className="h-2">
            <MeterPart className="bg-foreground/40" weight={18} />
            <MeterPart className={kindFillClass("review")} weight={18} />
            <MeterPart className={kindFillClass("challenge")} weight={10} />
          </MeterParts>
        </Specimen>
      </DocSection>
    </>
  );
}
