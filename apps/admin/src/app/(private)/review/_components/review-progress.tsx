export function ReviewProgress({ remaining }: { remaining: number }) {
  return (
    <p className="text-muted-foreground text-sm">
      {remaining} pending {remaining === 1 ? "review" : "reviews"}
    </p>
  );
}
