interface PageHeaderProps {
  children: React.ReactNode;
}

export function PageHeader({ children }: PageHeaderProps) {
  return <header className="flex flex-col gap-1">{children}</header>;
}
