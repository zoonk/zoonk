import dump from "@/app/(private)/_mock/data/skill.json";
import { type Dump, FactsFrom, TableFrom, readView } from "@/app/(private)/_mock/kit";
import { MockMenu } from "@/app/(private)/_mock/menu";
import {
  AdminDetailBody,
  AdminDetailColumns,
  AdminDetailHeader,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSection } from "@/components/admin-section";
import { AdminRecordTabs } from "@/components/admin-tabs";
import { DetailField, DetailFields } from "@/components/detail-field";
import { MockLink } from "../../_mock/parts";

const skill = dump as Dump;

const TABS = [
  { label: "Overview", value: "overview" },
  { label: "Used in", value: "used" },
  { label: "Details", value: "details" },
] as const;

const BUILDS_TOWARD = [
  ["Aplicar semelhança de figuras", "Intermediate"],
  ["Calcular probabilidades de eventos", "Intermediate"],
  ["Calcular probabilidades simples", "Intermediate"],
  ["Calcular variações percentuais", "Intermediate"],
  ["Converter unidades e escalas", "Intermediate"],
  ["Resolver medidas em triângulos", "Intermediate"],
  ["Usar escalas", "Beginner"],
] as const;

function SkillList({ skills }: { skills: readonly (readonly [string, string])[] }) {
  return (
    <ul className="divide-y">
      {skills.map(([name, level]) => (
        <li className="flex min-h-11 items-center justify-between gap-4 text-sm" key={name}>
          <MockLink>{name}</MockLink>
          <span className="text-muted-foreground shrink-0 text-xs">{level}</span>
        </li>
      ))}
    </ul>
  );
}

function Overview() {
  return (
    <AdminDetailColumns
      aside={
        <>
          <AdminSection title="Learners">
            <DetailFields>
              <DetailField label="New">0</DetailField>
              <DetailField label="Learning">0</DetailField>
              <DetailField label="Solid">49</DetailField>
              <DetailField label="Mastered">7</DetailField>
            </DetailFields>
          </AdminSection>

          <AdminSection title="Used in">
            <DetailFields>
              <DetailField label="Lessons">
                <MockLink>2</MockLink>
              </DetailField>
              <DetailField label="Chapters">
                <MockLink>5</MockLink>
              </DetailField>
              <DetailField label="Practice questions">
                <MockLink>4</MockLink>
              </DetailField>
            </DetailFields>
          </AdminSection>
        </>
      }
    >
      <AdminSection title="What the learner sees">
        <p className="max-w-2xl text-sm leading-6">
          Quando duas grandezas crescem juntas, a razão se mantém: se 3 kg custam R$ 12, 5 kg custam
          R$ 20.
        </p>
      </AdminSection>

      <div className="grid gap-8 md:grid-cols-2">
        <AdminSection title="Learned before this (1)">
          <SkillList skills={[["Operar com números racionais e reais", "Intermediate"]]} />
        </AdminSection>

        <AdminSection title="Learned after this (7)">
          <SkillList skills={BUILDS_TOWARD} />
        </AdminSection>
      </div>
    </AdminDetailColumns>
  );
}

function UsedIn() {
  return (
    <>
      <AdminSection title="Lessons (2)">
        <TableFrom dump={skill} omit={["Visibility"]} section="Lessons" />
      </AdminSection>
      <AdminSection title="Chapters (5)">
        <TableFrom dump={skill} omit={["Visibility"]} section="Chapters" />
      </AdminSection>
      <AdminSection title="Practice questions (4)">
        <TableFrom
          dump={skill}
          omit={["Field"]}
          rename={{ Item: "Question" }}
          section="Items"
          sizes={{ Format: "wide" }}
        />
      </AdminSection>
    </>
  );
}

function Details() {
  return (
    <AdminDetailColumns
      aside={
        <AdminSection title="Written by">
          <FactsFrom dump={skill} section="Provenance" />
        </AdminSection>
      }
    >
      <AdminSection title="Details">
        <FactsFrom dump={skill} omit={["Card front"]} section="Details" />
      </AdminSection>
    </AdminDetailColumns>
  );
}

const BODIES: Record<string, () => React.ReactNode> = { details: Details, used: UsedIn };

export default async function SkillMockPage({ searchParams }: PageProps<"/skills/mock">) {
  const tab = readView((await searchParams).tab) || "overview";
  const Body = BODIES[tab] ?? Overview;

  return (
    <AdminDetailPage>
      <AdminDetailHeader
        facts={["Beginner", "Portuguese", "Open to everyone", "56 learners"]}
        menu={<MockMenu actions={[{ label: "Merge into another skill" }]} label="Skill actions" />}
        parents={[{ href: "/skills", label: "Skills" }]}
        title="Resolver proporções com regra de três"
      />

      <AdminDetailBody>
        <AdminRecordTabs
          current={tab as "overview"}
          label="Skill"
          path="/skills/mock"
          tabs={TABS}
        />

        <Body />
      </AdminDetailBody>
    </AdminDetailPage>
  );
}
