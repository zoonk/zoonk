import {
  AdminDetailBody,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSection, AdminSectionSkeleton } from "@/components/admin-section";
import { DetailField, DetailFields } from "@/components/detail-field";
import { type AdminPrompt, getPrompt } from "@/data/prompts/get-prompt";
import { formatDateTime } from "@/lib/format";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  getPromptLearnerEmail,
  getPromptLearnerLabel,
  promptOutcomeLabels,
} from "../_utils/prompt-labels";
import { PromptGoals } from "./prompt-goals";
import { PromptReading } from "./prompt-reading";

export async function generateMetadata({ params }: PageProps<"/prompts/[id]">): Promise<Metadata> {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const prompt = await getPrompt(id);

  if (!prompt) {
    notFound();
  }

  return { title: getPromptTitle(prompt) };
}

function getPromptTitle(prompt: AdminPrompt): string {
  return `Prompt from ${getPromptLearnerLabel(prompt.user)}`;
}

const PROMPT_PARENTS = [{ href: "/prompts", label: "Prompts" }];

export default function PromptDetailPage({ params }: PageProps<"/prompts/[id]">) {
  return (
    <AdminDetailPage>
      <Suspense fallback={<PromptDetailSkeleton />}>
        <PromptDetailContent params={params} />
      </Suspense>
    </AdminDetailPage>
  );
}

function PromptDetails({ prompt }: { prompt: AdminPrompt }) {
  const { user } = prompt;
  const email = getPromptLearnerEmail(user);

  return (
    <DetailFields>
      <DetailField label="Learner">
        <Link className="hover:underline" href={`/users/${user.id}`} prefetch>
          {getPromptLearnerLabel(user)}
        </Link>
        {email && <span className="text-muted-foreground block">{email}</span>}
      </DetailField>
      <DetailField label="Language">{prompt.language}</DetailField>
      <DetailField label="Time zone">{prompt.timeZone}</DetailField>
      <DetailField label="Status">{prompt.status}</DetailField>
      <DetailField label="Run">{prompt.runId ?? "—"}</DetailField>
      <DetailField label="Typed">{formatDateTime(prompt.createdAt)}</DetailField>
      <DetailField label="Updated">{formatDateTime(prompt.updatedAt)}</DetailField>
    </DetailFields>
  );
}

async function PromptDetailContent({ params }: Pick<PageProps<"/prompts/[id]">, "params">) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const prompt = await getPrompt(id);

  if (!prompt) {
    notFound();
  }

  const failed = prompt.outcome === "failed";

  return (
    <>
      <AdminDetailHeader
        alert={failed ? promptOutcomeLabels.failed : null}
        facts={[
          !failed && promptOutcomeLabels[prompt.outcome],
          prompt.language,
          `Typed ${formatDateTime(prompt.createdAt)}`,
        ]}
        parents={PROMPT_PARENTS}
        title={getPromptTitle(prompt)}
      />

      <AdminDetailBody>
        <AdminSection title="Prompt">
          <p className="max-w-3xl leading-7 wrap-break-word whitespace-pre-wrap">{prompt.prompt}</p>
        </AdminSection>

        <AdminSection
          description="What Zoonk read in the words, with any fixes the learner made to the card."
          title="Read as"
        >
          <PromptReading prompt={prompt} />
        </AdminSection>

        <AdminSection title="Goals created">
          <PromptGoals prompt={prompt} />
        </AdminSection>

        <AdminSection title="Details">
          <PromptDetails prompt={prompt} />
        </AdminSection>
      </AdminDetailBody>
    </>
  );
}

function PromptDetailSkeleton() {
  return (
    <>
      <AdminDetailHeaderSkeleton parents={PROMPT_PARENTS} />

      <AdminDetailBody>
        <AdminSectionSkeleton>
          <div className="flex max-w-3xl flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        </AdminSectionSkeleton>
        <AdminSectionSkeleton description rows={2} />
        <AdminSectionSkeleton rows={1} />
        <AdminSectionSkeleton rows={7} />
      </AdminDetailBody>
    </>
  );
}
