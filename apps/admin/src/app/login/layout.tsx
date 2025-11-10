export default function AuthLayout({ children }: LayoutProps<"/login">) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      {children}
    </div>
  );
}
