import { ButtonSkeleton } from "@zoonk/ui/components/button";
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
import { parseLeaderboardPeriod } from "./leaderboard-period";
import { LeaderboardPeriodFilter } from "./leaderboard-period-filter";

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
            Users who earned the most Brain Power during the selected period.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<LeaderboardPeriodFilterSkeleton />}>
          <LeaderboardFilters searchParams={searchParams} />
        </Suspense>

        <Suspense fallback={<BrainPowerLeaderboardSkeleton />}>
          <BrainPowerLeaderboard searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}

async function LeaderboardFilters({
  searchParams,
}: Pick<PageProps<"/leaderboard">, "searchParams">) {
  const params = await searchParams;
  const period = parseLeaderboardPeriod(params.period);

  return <LeaderboardPeriodFilter period={period} />;
}

function LeaderboardPeriodFilterSkeleton() {
  return (
    <div className="flex gap-1">
      <ButtonSkeleton size="sm">Today</ButtonSkeleton>
      <ButtonSkeleton size="sm">7 days</ButtonSkeleton>
      <ButtonSkeleton size="sm">30 days</ButtonSkeleton>
    </div>
  );
}
