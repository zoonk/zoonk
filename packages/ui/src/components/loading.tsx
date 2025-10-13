export function FullPageLoading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="h-16 w-16 animate-pulse rounded-full bg-primary fill-mode-forwards opacity-0 delay-300" />
    </div>
  );
}
