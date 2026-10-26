import { PATTERNS } from "@/design-system/patterns";
import { AnswerOption, AnswerOptionGroup } from "@zoonk/learn/answer-option";
import { BigQuantity } from "@zoonk/learn/big-quantity";
import { KindMark, kindFillClass } from "@zoonk/learn/kind-tile";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowTitle,
  ListRowTrailing,
} from "@zoonk/learn/list";
import { MeterPart, MeterParts } from "@zoonk/learn/meter";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "@zoonk/learn/page";
import { StatusMark } from "@zoonk/learn/status-mark";
import { SubjectGlyph, SubjectLabel } from "@zoonk/learn/subject-label";
import { Surface } from "@zoonk/learn/surface";
import { Button } from "@zoonk/ui/components/button";
import { type Metadata } from "next";
import { PreviewIntlProvider } from "../../preview/preview-intl-provider";
import { DoDont, DocHeader, DocSection, Specimen } from "../_components/doc";

export const metadata: Metadata = { title: "Components and patterns" };

function ActionsSpecimen() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="lg">Continue session</Button>
      <Button size="lg" variant="outline">
        Adjust plan
      </Button>
      <Button size="lg" variant="ghost">
        Not now
      </Button>
    </div>
  );
}

function AnswersSpecimen() {
  return (
    <AnswerOptionGroup className="max-w-column">
      <AnswerOption marker={1} picked={false}>
        At rest
      </AnswerOption>
      <AnswerOption marker={2} picked>
        Picked, before it&apos;s checked
      </AnswerOption>
      <AnswerOption marker={3} picked result="right">
        Checked right
      </AnswerOption>
      <AnswerOption marker={4} picked result="wrong">
        Checked wrong
      </AnswerOption>
      <AnswerOption marker={5} picked={false} result="right">
        The right answer the learner didn&apos;t pick
      </AnswerOption>
    </AnswerOptionGroup>
  );
}

function StatusSpecimen() {
  return (
    <ListGroup className="max-w-column">
      <ListRow>
        <ListRowLeading>
          <StatusMark status="done" />
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle className="text-muted-foreground">Quick review</ListRowTitle>
        </ListRowContent>
        <ListRowTrailing>2 min</ListRowTrailing>
      </ListRow>
      <ListRow aria-current="step">
        <ListRowLeading>
          <StatusMark status="next" />
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle>Writing very big and very small numbers</ListRowTitle>
          <ListRowDescription>Exponents and scientific notation</ListRowDescription>
        </ListRowContent>
        <ListRowTrailing>5 min</ListRowTrailing>
      </ListRow>
      <ListRow>
        <ListRowLeading>
          <StatusMark status="todo" />
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle>Multiplying and dividing powers of ten</ListRowTitle>
        </ListRowContent>
        <ListRowTrailing>5 min</ListRowTrailing>
      </ListRow>
    </ListGroup>
  );
}

function KindsSpecimen() {
  return (
    <ListGroup className="max-w-column">
      {(
        [
          ["lesson", "Adding vectors", "4 min"],
          ["review", "Quick review", "2 min"],
          ["practice", "Mixed practice", "6 min"],
          ["challenge", "Phase challenge", "8 min"],
        ] as const
      ).map(([kind, title, minutes]) => (
        <ListRow key={kind}>
          <ListRowLeading>
            <KindMark kind={kind} />
          </ListRowLeading>
          <ListRowContent>
            <ListRowTitle>{title}</ListRowTitle>
          </ListRowContent>
          <ListRowTrailing>{minutes}</ListRowTrailing>
        </ListRow>
      ))}
    </ListGroup>
  );
}

function ReadoutsSpecimen() {
  return (
    <div className="max-w-column flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-muted-foreground font-mono text-xs tabular-nums">1 of 12 done</p>
        <BigQuantity className="text-2xl">43 min left</BigQuantity>
      </div>
      <MeterParts>
        <MeterPart className="bg-success" weight={2} />
        <MeterPart className="ring-selected bg-transparent ring-[1.5px] ring-inset" weight={5} />
        <MeterPart weight={5} />
        <MeterPart weight={3} />
        <MeterPart weight={4} />
        <MeterPart className={kindFillClass("practice")} weight={6} />
      </MeterParts>
    </div>
  );
}

function SubjectsSpecimen() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Surface className="flex flex-col gap-2 p-4">
        <SubjectLabel subject="science">Science</SubjectLabel>
        <p className="text-[0.9375rem] font-semibold">Quantum physics from scratch</p>
        <p className="text-muted-foreground font-mono text-xs">301 lessons · about 20 hr</p>
      </Surface>
      <ul className="flex flex-col gap-2 text-sm">
        {(["economics", "languages", "science", "society"] as const).map((subject) => (
          <li className="flex items-center gap-2.5" key={subject}>
            <SubjectGlyph subject={subject} />
            {subject.charAt(0).toUpperCase() + subject.slice(1)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StructureSpecimen() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <StatusSpecimen />
      <Surface className="flex flex-col gap-1 p-4 text-sm">
        <p className="font-medium">A notice</p>
        <p className="text-muted-foreground">
          A panel holds one self-contained thing, on the page.
        </p>
      </Surface>
    </div>
  );
}

function TitlesSpecimen() {
  return (
    <PageSection className="max-w-column">
      <PageSectionHeader>
        <PageSectionTitle>This week</PageSectionTitle>
        <PageSectionDetail>1 of 7 days</PageSectionDetail>
      </PageSectionHeader>
      <p className="text-muted-foreground text-sm">The block&apos;s content follows its title.</p>
    </PageSection>
  );
}

const SPECIMENS: Record<string, () => React.ReactNode> = {
  actions: ActionsSpecimen,
  answers: AnswersSpecimen,
  kinds: KindsSpecimen,
  readouts: ReadoutsSpecimen,
  status: StatusSpecimen,
  structure: StructureSpecimen,
  subjects: SubjectsSpecimen,
  titles: TitlesSpecimen,
};

export default function PatternsPage() {
  return (
    <PreviewIntlProvider>
      <DocHeader title="Components and patterns">
        One way to draw each thing, from the shared components. Specimens are the real components,
        in this device&apos;s mode.
      </DocHeader>

      {PATTERNS.map((pattern) => {
        const Example = SPECIMENS[pattern.id];

        return (
          <DocSection
            id={pattern.id}
            intro={pattern.summary}
            key={pattern.id}
            title={pattern.title}
          >
            {Example && (
              <Specimen>
                <Example />
              </Specimen>
            )}
            <DoDont avoid={pattern.avoid} follow={pattern.follow} />
          </DocSection>
        );
      })}
    </PreviewIntlProvider>
  );
}
