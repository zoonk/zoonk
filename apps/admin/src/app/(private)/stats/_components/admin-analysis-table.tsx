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
      {children}
    </section>
  );
}
