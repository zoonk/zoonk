export function QuestionDetailField({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="max-w-2xl text-right text-sm wrap-break-word">{children}</dd>
    </div>
  );
}
