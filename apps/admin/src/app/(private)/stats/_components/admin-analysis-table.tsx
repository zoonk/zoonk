/**
 * Non-trend analyses use the same open hierarchy as charts: a concise
 * explanation followed by the complete table, with only one subtle boundary
 * around dense row data.
 */
export function AdminAnalysisTable({
  children,
  description,
}: {
  children: React.ReactNode;
  description: string;
}) {
  return (
    <section className="flex flex-col gap-6 py-4">
      <p className="text-muted-foreground max-w-2xl text-sm">{description}</p>
      <div className="overflow-hidden rounded-xl border">{children}</div>
    </section>
  );
}
