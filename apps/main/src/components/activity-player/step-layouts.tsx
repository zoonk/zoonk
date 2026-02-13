export function StaticStepLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex w-full max-w-2xl flex-1 flex-col">{children}</div>;
}

export function StaticStepVisual({ children }: { children?: React.ReactNode }) {
  return <div className="flex flex-1 items-center justify-center">{children}</div>;
}

export function StaticStepText({ children }: { children: React.ReactNode }) {
  return <div className="text-center">{children}</div>;
}

export function InteractiveStepLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex w-full max-w-2xl flex-col gap-6">{children}</div>;
}
