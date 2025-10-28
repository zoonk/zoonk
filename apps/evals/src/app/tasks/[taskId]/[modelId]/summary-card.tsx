import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@zoonk/ui/components/card";

type SummaryCardProps = {
  averageScore: number;
  averageInputTokens: number;
  averageOutputTokens: number;
  averageDuration: number;
  totalCost: number;
};

type StatItemProps = {
  label: string;
  value: string | number;
};

function StatItem({ label, value }: StatItemProps) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="font-bold text-2xl">{value}</p>
    </div>
  );
}

export function SummaryCard({
  averageScore,
  averageInputTokens,
  averageOutputTokens,
  averageDuration,
  totalCost,
}: SummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Summary</CardTitle>
      </CardHeader>

      <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatItem label="Average Score" value={averageScore.toFixed(2)} />

        <StatItem
          label="Avg Input Tokens"
          value={Math.round(averageInputTokens)}
        />

        <StatItem
          label="Avg Output Tokens"
          value={Math.round(averageOutputTokens)}
        />

        <StatItem
          label="Avg Duration"
          value={`${averageDuration.toFixed(2)}s`}
        />

        <StatItem label="Cost (1000 runs)" value={`$${totalCost.toFixed(2)}`} />
      </CardContent>
    </Card>
  );
}
