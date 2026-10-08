import { AdminSection, AdminSectionEmpty, AdminSectionSkeleton } from "@/components/admin-section";
import { MIN_VOTES_FOR_RATE, listDownvoteRates } from "@/data/feedback/list-downvote-rates";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { Suspense } from "react";
import { FeedbackViewsNav } from "../feedback-views-nav";
import { DownvoteRateTable } from "./downvote-rate-table";

export const metadata: Metadata = { title: "Downvote Rates" };

export default function DownvoteRatesPage() {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Downvote Rates</ContainerTitle>
          <ContainerDescription>
            How often learners vote AI content down, per model, prompt version and content kind.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="gap-8">
        <FeedbackViewsNav current="/feedback/rates" />

        <Suspense fallback={<DownvoteRatesSkeleton />}>
          <DownvoteRates />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}

async function DownvoteRates() {
  "use cache: private";

  const { ranked, unranked } = await listDownvoteRates();

  if (ranked.length === 0 && unranked.length === 0) {
    return <AdminSectionEmpty>No votes yet.</AdminSectionEmpty>;
  }

  return (
    <>
      <AdminSection
        description={`Groups with at least ${MIN_VOTES_FOR_RATE} votes, highest downvote rate first.`}
        title="Ranked by downvote rate"
      >
        {ranked.length > 0 ? (
          <DownvoteRateTable groups={ranked} />
        ) : (
          <AdminSectionEmpty>
            No group has {MIN_VOTES_FOR_RATE} votes yet, so nothing is ranked.
          </AdminSectionEmpty>
        )}
      </AdminSection>

      {unranked.length > 0 ? (
        <AdminSection
          description={`Fewer than ${MIN_VOTES_FOR_RATE} votes, so their rates can still swing a lot. Most votes first.`}
          title="Too few votes to rank"
        >
          <DownvoteRateTable groups={unranked} />
        </AdminSection>
      ) : null}
    </>
  );
}

function DownvoteRatesSkeleton() {
  return (
    <>
      <AdminSectionSkeleton />
      <AdminSectionSkeleton />
    </>
  );
}
