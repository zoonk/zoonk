export function FullPageLoading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="h-16 w-16 rounded-full bg-primary animate-pulse opacity-0 delay-300 fill-mode-forwards" />
    </div>
  );
}
