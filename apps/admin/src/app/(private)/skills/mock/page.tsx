import {
  AdminDetailBody,
  AdminDetailColumns,
  AdminDetailHeader,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSection } from "@/components/admin-section";
import { AdminTabs } from "@/components/admin-tabs";
import { DetailField, DetailFields } from "@/components/detail-field";
import { Button } from "@zoonk/ui/components/button";
import { EllipsisIcon } from "lucide-react";
import { MockLink } from "../../_mock/parts";

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
        <li className="flex items-baseline justify-between gap-4 py-2 text-sm" key={name}>
          <MockLink>{name}</MockLink>
          <span className="text-muted-foreground shrink-0 text-xs">{level}</span>
        </li>
      ))}
    </ul>
  );
}

export default function SkillMockPage() {
  return (
    <AdminDetailPage>
      <AdminDetailHeader
        facts={["Beginner", "Portuguese", "Open to everyone", "56 learners"]}
        menu={
          <Button
            aria-label="Skill actions"
            className="size-11 shrink-0"
            size="icon"
            variant="outline"
          >
            <EllipsisIcon aria-hidden="true" />
          </Button>
        }
        parents={[{ href: "/skills", label: "Skills" }]}
        title="Resolver proporções com regra de três"
      />

      <AdminDetailBody>
        <AdminTabs current="overview" label="Skill" path="/skills/mock" tabs={TABS} />

        <AdminDetailColumns
          aside={
            <>
              <AdminSection title="Learners">
                <DetailFields>
                  <DetailField label="Mastered">7</DetailField>
                  <DetailField label="Solid">49</DetailField>
                  <DetailField label="Learning">0</DetailField>
                  <DetailField label="New">0</DetailField>
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
              Quando duas grandezas crescem juntas, a razão se mantém: se 3 kg custam R$ 12, 5 kg
              custam R$ 20.
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
      </AdminDetailBody>
    </AdminDetailPage>
  );
}
