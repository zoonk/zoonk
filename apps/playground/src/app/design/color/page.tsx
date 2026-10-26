import { COLOR_GROUPS, COLOR_RULES } from "@/design-system/color";
import { type Subject, SubjectGlyph, SubjectLabel } from "@zoonk/learn/subject-label";
import { cn } from "@zoonk/ui/lib/utils";
import { COURSE_CATEGORIES } from "@zoonk/utils/categories";
import { type Metadata } from "next";
import { DocHeader, DocRules, DocSection } from "../_components/doc";
import { MODES, modeClass } from "../_components/modes";
import { SwatchTable } from "../_components/swatch-table";

export const metadata: Metadata = { title: "Color" };

const SUBJECTS: readonly Subject[] = [...COURSE_CATEGORIES, "general"];

function subjectName(subject: Subject): string {
  return subject.charAt(0).toUpperCase() + subject.slice(1);
}

/** Every subject's label, glyph and line in each mode, from the one hue table in `globals.css`. */
function SubjectTable() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {MODES.map((mode) => (
        <div
          className={cn(
            modeClass(mode.id),
            "ring-border flex flex-col gap-2.5 rounded-xl p-4 ring-1",
          )}
          key={mode.id}
        >
          <p className="text-muted-foreground pb-1 text-xs font-medium">{mode.label}</p>
          {SUBJECTS.map((subject) => (
            <div
              className="flex items-center justify-between gap-3"
              data-subject={subject}
              key={subject}
            >
              <SubjectLabel subject={subject}>{subjectName(subject)}</SubjectLabel>
              <span className="flex items-center gap-2">
                <SubjectGlyph subject={subject} />
                <span aria-hidden="true" className="bg-subject h-1 w-10 rounded-full" />
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function ColorPage() {
  return (
    <>
      <DocHeader title="Color">
        Every token with what it means and where it goes, and its value in each mode, read live from
        `globals.css`. Ratios are WCAG 2 contrast against the mode&apos;s page: marks are measured
        against 3:1, words against 4.5:1, and a ratio under its bar shows in amber. The regular
        theme stays soft on purpose; the more-contrast modes are strict.
      </DocHeader>

      <DocSection title="Rules">
        <DocRules rules={COLOR_RULES} />
      </DocSection>

      {COLOR_GROUPS.map((group) => (
        <DocSection id={group.id} intro={group.intro} key={group.id} title={group.title}>
          <SwatchTable
            contrast={group.id !== "surfaces"}
            subject={group.id === "subjects" ? "science" : undefined}
            tokens={group.tokens}
          />
          {group.id === "subjects" && <SubjectTable />}
        </DocSection>
      ))}
    </>
  );
}
