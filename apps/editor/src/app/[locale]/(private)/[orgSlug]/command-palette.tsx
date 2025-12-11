"use client";

import type { Course } from "@zoonk/core/types";
import { Badge } from "@zoonk/ui/components/badge";
import { Button } from "@zoonk/ui/components/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@zoonk/ui/components/command";
import { useKeyboardShortcut } from "@zoonk/ui/hooks/use-keyboard-shortcut";
import { HomeIcon, Search } from "lucide-react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { searchCoursesAction } from "./actions";

const SEARCH_DEBOUNCE_MS = 300;

export function EditorCommandPalette() {
  const { push } = useRouter();
  const params = useParams();
  const t = useExtracted();
  const [query, setQuery] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [isSearching, startTransition] = useTransition();
  const { isOpen, open, close } = useKeyboardShortcut("k");

  const orgSlug = params.orgSlug as string;

  // Debounced course search
  useEffect(() => {
    if (!query.trim()) {
      setCourses([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      startTransition(async () => {
        const { courses: results } = await searchCoursesAction(orgSlug, query);
        setCourses(results);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [query, orgSlug]);

  const closePalette = () => {
    close();
    setQuery("");
    setCourses([]);
  };

  const onSelectItem = (item: string) => {
    closePalette();
    push(item);
  };

  const staticPages = [
    {
      icon: HomeIcon,
      key: t("Home page"),
      url: `/${orgSlug}`,
    },
  ];

  const filteredStaticPages = staticPages.filter((page) =>
    page.key.toLowerCase().includes(query.toLowerCase().trim()),
  );

  return (
    <>
      <Button
        aria-keyshortcuts="Meta+K Control+K"
        onClick={open}
        size="icon"
        variant="outline"
      >
        <Search />
        <span className="sr-only">{t("Search")}</span>
      </Button>

      <CommandDialog
        className="top-4 translate-y-0 lg:top-1/2 lg:translate-y-[-50%]"
        closeLabel={t("Close search")}
        description={t("Search courses or pages...")}
        onOpenChange={closePalette}
        open={isOpen}
        shouldFilter={false}
        title={t("Search")}
      >
        <CommandInput
          onValueChange={setQuery}
          placeholder={t("Search courses or pages...")}
          value={query}
        />

        <CommandList>
          <CommandEmpty>
            <p>{isSearching ? t("Searching...") : t("No results found")}</p>
          </CommandEmpty>

          {courses.length > 0 && (
            <CommandGroup heading={t("Courses")}>
              {courses.map((course) => (
                <CommandItem
                  key={course.id}
                  onSelect={() =>
                    onSelectItem(`/${orgSlug}/courses/${course.slug}`)
                  }
                >
                  <Image
                    alt={course.title}
                    className="size-8 rounded object-cover"
                    height={32}
                    src={course.imageUrl}
                    width={32}
                  />
                  <span className="flex-1">{course.title}</span>
                  <Badge className="uppercase" variant="outline">
                    {course.language}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {filteredStaticPages.length > 0 && (
            <CommandGroup heading={t("Pages")}>
              {filteredStaticPages.map((item) => (
                <CommandItem
                  key={item.key}
                  onSelect={() => onSelectItem(item.url)}
                >
                  <item.icon aria-hidden="true" />
                  {item.key}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
