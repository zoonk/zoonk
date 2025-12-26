import { useDebounce } from "@zoonk/ui/hooks/debounce";
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

  const handleSlugCheck = useEffectEvent(
    (checkedSlug: string, exists: boolean) => {
      // Only update if response is for the current slug to avoid stale results
      if (checkedSlug === debouncedSlug) {
        setSlugExists(exists);
      }
    },
  );

  useEffect(() => {
    if (!debouncedSlug.trim()) {
      setSlugExists(false);
      return;
    }

    startTransition(async () => {
      const exists = await checkSlugExists({
        language,
        orgSlug,
        slug: debouncedSlug,
      });

      handleSlugCheck(debouncedSlug, exists);
    });
  }, [debouncedSlug, language, orgSlug]);

  return slugExists;
}
