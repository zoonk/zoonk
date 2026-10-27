import { ProvideLearnerSeed } from "@/components/learner/learner-seed-provider";

/**
 * The catalog is static, for everyone and for search: its pages don't read the learner, so the
 * app's frame shows them from the browser's summary once it's read (`ProvideLearnerSeed`).
 */
export default function CatalogLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <>
      {children}
      <ProvideLearnerSeed seed={null} />
    </>
  );
}
