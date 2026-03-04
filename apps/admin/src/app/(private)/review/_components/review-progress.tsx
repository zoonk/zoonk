export function ReviewProgress({ remaining }: { remaining: number }) {
  return (
    <p className="text-muted-foreground text-sm">
      {remaining} pending review
    </p>
  );
}
