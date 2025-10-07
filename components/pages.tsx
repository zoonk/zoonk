export function PageContainer({ children }: React.ComponentProps<"main">) {
  return <main className="flex flex-col gap-4 p-4">{children}</main>;
}

export function PageHeader({ children }: React.ComponentProps<"header">) {
  return <header className="flex flex-col gap-0.5">{children}</header>;
}

export function PageTitle({ children }: React.ComponentProps<"h1">) {
  return (
    <h1 className="scroll-m-20 text-balance font-semibold text-foreground/90 text-xl leading-none tracking-tight">
      {children}
    </h1>
  );
}

export const PageSubtitle = ({ children }: React.ComponentProps<"h2">) => (
  <h2 className="text-balance text-muted-foreground tracking-tight">
    {children}
  </h2>
);
