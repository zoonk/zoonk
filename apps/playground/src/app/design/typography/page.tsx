import { TYPE_ROLES, TYPE_RULES } from "@/design-system/type";
import { BigQuantity } from "@zoonk/learn/big-quantity";
import { PageSectionTitle } from "@zoonk/learn/page";
import { cn } from "@zoonk/ui/lib/utils";
import { type Metadata } from "next";
import { DocHeader, DocRules, DocSection, Specimen, renderCode } from "../_components/doc";

export const metadata: Metadata = { title: "Typography" };

export default function TypographyPage() {
  return (
    <>
      <DocHeader title="Typography">
        Geist for words and Geist Mono for data, one family with a steep ramp. Each role is one
        class with one job; the sizes live in `globals.css` and Tailwind&apos;s scale.
      </DocHeader>

      <DocSection title="Rules">
        <DocRules rules={TYPE_RULES} />
      </DocSection>

      <DocSection title="Roles">
        <div className="flex flex-col">
          {TYPE_ROLES.map((role) => (
            <div
              className="border-border grid gap-4 border-t py-5 lg:grid-cols-[14rem_minmax(0,1fr)]"
              key={role.name}
            >
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold">{role.name}</p>
                <code className="text-muted-foreground font-mono text-xs wrap-break-word">
                  {role.component ? `<${role.component}>` : role.className}
                </code>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {renderCode(role.use)}
                </p>
              </div>
              {role.component === "PageSectionTitle" ? (
                <PageSectionTitle>{role.sample}</PageSectionTitle>
              ) : (
                <p className={cn("min-w-0", role.className)}>{role.sample}</p>
              )}
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection
        intro="A readout leads with the number in the text face; its unit follows small and muted. Data in rows and eyebrows stays mono."
        title="Numerals"
      >
        <Specimen className="flex flex-wrap items-end gap-x-12 gap-y-6">
          <BigQuantity className="text-[2.5rem]">43 min left</BigQuantity>
          <BigQuantity className="text-[3.5rem]">~38 weeks</BigQuantity>
          <p className="text-muted-foreground font-mono text-xs tabular-nums">
            MON, OCT 26 · 1 of 12 done
          </p>
        </Specimen>
      </DocSection>
    </>
  );
}
