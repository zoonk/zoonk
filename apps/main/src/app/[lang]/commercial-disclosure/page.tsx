import { COMMERCIAL_DISCLOSURE_TITLE } from "@/components/public/commercial-disclosure-link";
import { LegalDocument } from "@/components/public/legal-document";
import { type Metadata } from "next";
import CommercialDisclosure from "./ja.mdx";

export const ensureStatic = "navigation";

/** Japan's Act on Specified Commercial Transactions requires this page, in Japanese, whatever the reader's language. */
export const metadata: Metadata = {
  description: `Zoonk Plusの${COMMERCIAL_DISCLOSURE_TITLE}です。`,
  title: COMMERCIAL_DISCLOSURE_TITLE,
};

export default function CommercialDisclosurePage() {
  return (
    <LegalDocument lang="ja" pathname="/commercial-disclosure">
      <CommercialDisclosure />
    </LegalDocument>
  );
}
