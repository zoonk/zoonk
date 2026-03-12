import { MediaCardPopoverAILabel, MediaCardPopoverMeta } from "@zoonk/ui/components/media-card";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { getExtracted } from "next-intl/server";

export async function AIWarning({ brandSlug }: { brandSlug: string }) {
  if (brandSlug !== AI_ORG_SLUG) {
    return null;
  }

  const t = await getExtracted();

  return (
    <MediaCardPopoverMeta>
      <MediaCardPopoverAILabel>{t("Created with AI")}</MediaCardPopoverAILabel>
    </MediaCardPopoverMeta>
  );
}
