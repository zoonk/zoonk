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
import { BrainPowerLeaderboard, BrainPowerLeaderboardSkeleton } from "./brain-power-leaderboard";

export const metadata: Metadata = { title: "Brain Power Leaderboard" };

/**
 * The leaderboard gives admins one focused view of recent learning activity,
 * separate from the lifetime Brain Power ordering on the broader users page.
 */
export default function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Brain Power Leaderboard</ContainerTitle>
          <ContainerDescription>
            Users who earned the most Brain Power in the past 7 days.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<BrainPowerLeaderboardSkeleton />}>
          <BrainPowerLeaderboard searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
