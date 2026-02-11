import { Skeleton } from "@zoonk/ui/components/skeleton";

export default function ActivityPlayerLoading() {
  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between p-4">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-4 w-12" />
      </header>

      <Skeleton className="h-0.5 w-full rounded-none" />

      <section className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <Skeleton className="h-6 w-3/4 max-w-md" />
        <Skeleton className="h-4 w-1/2 max-w-sm" />
      </section>

      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Skeleton className="h-10 w-full rounded-4xl" />
      </div>
    </main>
  );
}
