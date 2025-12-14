import { courseSlugExists } from "@zoonk/core/courses";
import { useDebouncedValue } from "@zoonk/ui/hooks/use-debounced-value";
import { toSlug } from "@zoonk/utils/string";
import { useEffect, useEffectEvent, useState, useTransition } from "react";

async function checkSlugExists({
  language,
  orgSlug,
  slug,
}: {
  language: string;
  orgSlug: string;
  slug: string;
}): Promise<boolean> {
  "use server";

  if (!slug.trim()) {
    return false;
  }

  return courseSlugExists({ language, orgSlug, slug: toSlug(slug) });
}

/**
 * Hook to check if a slug already exists with debouncing.
 */
export function useSlugCheck({
  language,
  orgSlug,
  slug,
}: {
  language: string;
  orgSlug: string;
  slug: string;
}) {
  const [_isPending, startTransition] = useTransition();
  const [slugExists, setSlugExists] = useState(false);

  const debouncedSlug = useDebouncedValue(slug);

  const handleSlugCheck = useEffectEvent((exists: boolean) => {
    setSlugExists(exists);
  });

  useEffect(() => {
    if (!debouncedSlug.trim()) {
      handleSlugCheck(false);
      return;
    }

    startTransition(async () => {
      const exists = await checkSlugExists({
        language,
        orgSlug,
        slug: debouncedSlug,
      });

      handleSlugCheck(exists);
    });
  }, [debouncedSlug, language, orgSlug]);

  return slugExists;
}
