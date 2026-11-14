import { ProvideLearnerSeed } from "@/components/learner/learner-seed-provider";
import { VisitorStartBar } from "@/components/public/visitor-start";

/** Static for everyone and for search: its pages don't read the learner; the frame does, from the browser. */
export default function CatalogLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <>
      {children}
      <VisitorStartBar />
      <ProvideLearnerSeed seed={null} />
    </>
  );
}
