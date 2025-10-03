interface PageContainerProps {
  children: React.ReactNode;
}

export function PageContainer({ children }: PageContainerProps) {
  return <main className="flex flex-col gap-4 p-4">{children}</main>;
}
