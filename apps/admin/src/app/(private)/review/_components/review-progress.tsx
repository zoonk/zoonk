export function ReviewProgress({ reviewed, total }: { reviewed: number; total: number }) {
  const remaining = total - reviewed;
  const percentage = total > 0 ? (reviewed / total) * 100 : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="text-muted-foreground flex justify-between text-sm">
        <span>
          {reviewed} of {total} reviewed
        </span>
        <span>{remaining} remaining</span>
      </div>
    </div>
  );
}
