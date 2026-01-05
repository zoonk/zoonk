"use client";

import { useDebounce } from "@zoonk/ui/hooks/debounce";
import { useEffect, useEffectEvent, useState, useTransition } from "react";

type SlugCheckParams = {
  language: string;
  orgSlug: string;
  slug: string;
};

type SlugCheckFn = (params: SlugCheckParams) => Promise<boolean>;

/**
 * Hook to check if a slug already exists with debouncing.
 * Works with any entity type (course, chapter, lesson) by accepting a check function.
 */
export function useSlugCheck({
  checkFn,
  initialSlug,
  language,
  orgSlug,
  slug,
}: SlugCheckParams & { checkFn: SlugCheckFn; initialSlug: string }) {
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
    // Skip check if empty or if it matches the current entity's slug
    if (!debouncedSlug.trim() || debouncedSlug.trim() === initialSlug.trim()) {
      setSlugExists(false);
      return;
    }

    startTransition(async () => {
      const exists = await checkFn({
        language,
        orgSlug,
        slug: debouncedSlug,
      });

      handleSlugCheck(debouncedSlug, exists);
    });
  }, [checkFn, debouncedSlug, initialSlug, language, orgSlug]);

  return slugExists;
}
