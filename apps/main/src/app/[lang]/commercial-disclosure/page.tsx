import { LegalDocument } from "@/components/public/legal-document";
import { type Metadata } from "next";
import CommercialDisclosure from "./ja.mdx";

export const ensureStatic = "navigation";

const TITLE = "特定商取引法に基づく表記";

/** Japan's Act on Specified Commercial Transactions requires this page, in Japanese, whatever the reader's language. */
export const metadata: Metadata = { description: `Zoonk Plusの${TITLE}です。`, title: TITLE };

export default function CommercialDisclosurePage() {
  return (
    <LegalDocument lang="ja" pathname="/commercial-disclosure">
      <CommercialDisclosure />
    </LegalDocument>
  );
}
