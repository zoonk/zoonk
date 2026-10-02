import { ProgressNavbar } from "./_components/progress-navbar";

/** Brain Power, Energy, activity, patterns and score, inside the learning tabs under Progress. */
export default function StatsLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <div className="flex flex-col">
      <ProgressNavbar />
      {children}
    </div>
  );
}
