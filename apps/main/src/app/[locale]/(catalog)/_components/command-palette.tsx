"use client";

import { authClient } from "@zoonk/core/auth/client";
import { Button } from "@zoonk/ui/components/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@zoonk/ui/components/command";
import { useCommandPaletteSearch } from "@zoonk/ui/hooks/command-palette-search";
import { BookOpenIcon, Search } from "lucide-react";
import Image from "next/image";
import { useExtracted, useLocale } from "next-intl";
import { useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import {
  type CourseSearchResult,
  searchCoursesAction,
} from "./search-courses-action";

export function CommandPalette() {
  const { push } = useRouter();
  const t = useExtracted();
  const locale = useLocale();

  const { data: session } = authClient.useSession();
  const isLoggedIn = Boolean(session);

  const handleSearch = useCallback(
    (searchQuery: string) =>
      searchCoursesAction({ language: locale, query: searchQuery }),
    [locale],
  );

  const {
    closePalette,
    isOpen,
    onSelectItem,
    open,
    query,
    results: courses,
    setQuery,
  } = useCommandPaletteSearch<CourseSearchResult[]>({
    emptyResults: [],
    onSearch: handleSearch,
  });

  const handleSelect = (url: string) => {
    onSelectItem();
    push(url);
  };

  const getStarted = [
    { key: t("Home page"), ...getMenu("home") },
    { key: t("Courses"), ...getMenu("courses") },
    { key: t("Learn something"), ...getMenu("learn") },
  ];

  const accountPublic = [
    { key: t("Login"), ...getMenu("login") },
    { key: t("Language"), ...getMenu("language") },
  ];

  const accountPrivate = [
    { key: t("My courses"), ...getMenu("myCourses") },
    { key: t("Manage subscription"), ...getMenu("subscription") },
    { key: t("Manage settings"), ...getMenu("settings") },
    { key: t("Update language"), ...getMenu("language") },
    { key: t("Update display name"), ...getMenu("displayName") },
    { key: t("Logout"), ...getMenu("logout") },
  ];

  const contactUs = [{ key: t("Help and support"), ...getMenu("support") }];

  const hasCourses = courses.length > 0;

  return (
    <>
      <Button
        aria-keyshortcuts="Meta+K Control+K"
        onClick={open}
        size="icon"
        variant="outline"
      >
        <Search aria-hidden="true" />
        <span className="sr-only">{t("Search")}</span>
      </Button>

      <CommandDialog
        className="top-4 translate-y-0 lg:top-1/2 lg:translate-y-[-50%]"
        description={t("Search courses or pages...")}
        onOpenChange={closePalette}
        open={isOpen}
        title={t("Search")}
      >
        <CommandInput
          onValueChange={setQuery}
          placeholder={t("Search courses or pages...")}
          value={query}
        />

        <CommandList>
          <CommandEmpty>
            <p>{t("No results found")}</p>
          </CommandEmpty>

          <CommandGroup heading={t("Pages")}>
            {getStarted.map((item) => (
              <CommandItem
                key={item.key}
                onSelect={() => handleSelect(item.url)}
              >
                <item.icon aria-hidden="true" />
                {item.key}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading={t("My account")}>
            {!isLoggedIn &&
              accountPublic.map((item) => (
                <CommandItem
                  key={item.key}
                  onSelect={() => handleSelect(item.url)}
                >
                  <item.icon aria-hidden="true" />
                  {item.key}
                </CommandItem>
              ))}

            {isLoggedIn &&
              accountPrivate.map((item) => (
                <CommandItem
                  key={item.key}
                  onSelect={() => handleSelect(item.url)}
                >
                  <item.icon aria-hidden="true" />
                  {item.key}
                </CommandItem>
              ))}
          </CommandGroup>

          <CommandGroup heading={t("Contact us")}>
            {contactUs.map((item) => (
              <CommandItem
                key={item.key}
                onSelect={() => handleSelect(item.url)}
              >
                <item.icon aria-hidden="true" />
                {item.key}
              </CommandItem>
            ))}
          </CommandGroup>

          {hasCourses && (
            <CommandGroup heading={t("Courses")}>
              {courses.map((course) => (
                <CourseItem
                  course={course}
                  key={course.id}
                  onSelect={handleSelect}
                />
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

function CourseItem({
  course,
  onSelect,
}: {
  course: CourseSearchResult;
  onSelect: (url: string) => void;
}) {
  const url = `/b/${course.brandSlug}/c/${course.slug}`;

  return (
    <CommandItem
      className="flex items-start gap-3"
      onSelect={() => onSelect(url)}
      value={`${course.title}-${course.id}`}
    >
      {course.imageUrl ? (
        <Image
          alt={course.title}
          className="size-8 shrink-0 rounded-md object-cover"
          height={32}
          src={course.imageUrl}
          width={32}
        />
      ) : (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <BookOpenIcon aria-hidden="true" className="size-4" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{course.title}</p>
        {course.description && (
          <p className="truncate text-muted-foreground text-xs">
            {course.description}
          </p>
        )}
      </div>
    </CommandItem>
  );
}
