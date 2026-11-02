import { ProvideLearnerSeed } from "@/components/learner/learner-seed-provider";

/** Static for everyone and for search: its pages don't read the learner; the frame does, from the browser. */
export default function CatalogLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <>
      {children}
      <ProvideLearnerSeed seed={null} />
    </>
  );
}
