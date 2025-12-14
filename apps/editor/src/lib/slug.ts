import { useDebounce } from "@zoonk/ui/hooks/use-debounce";
import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { checkSlugExists } from "./slug-action";

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

  const debouncedSlug = useDebounce(slug);

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
