"use client";

import {
  CatalogList,
  CatalogListContent,
  CatalogListItem,
  CatalogListItemContent,
  CatalogListItemDescription,
  CatalogListItemPosition,
  CatalogListItemTitle,
  CatalogListSearch,
} from "@/components/catalog/catalog-list";
import { type LessonForList } from "@/data/lessons/list-chapter-lessons";

export function LessonList({
  brandSlug,
  chapterSlug,
  courseSlug,
  emptyMessage,
  lessons,
  placeholder,
  searchLabel,
}: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  emptyMessage: string;
  lessons: LessonForList[];
  placeholder: string;
  searchLabel: string;
}) {
  if (lessons.length === 0) {
    return null;
  }

  return (
    <CatalogList>
      <CatalogListSearch ariaLabel={searchLabel} items={lessons} placeholder={placeholder}>
        <CatalogListContent emptyMessage={emptyMessage}>
          {lessons.map((lesson) => (
            <CatalogListItem
              href={`/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lesson.slug}`}
              id={lesson.id}
              key={lesson.id}
            >
              <CatalogListItemPosition>
                {String(lesson.position + 1).padStart(2, "0")}
              </CatalogListItemPosition>

              <CatalogListItemContent>
                <CatalogListItemTitle>{lesson.title}</CatalogListItemTitle>
                {lesson.description && (
                  <CatalogListItemDescription>{lesson.description}</CatalogListItemDescription>
                )}
              </CatalogListItemContent>
            </CatalogListItem>
          ))}
        </CatalogListContent>
      </CatalogListSearch>
    </CatalogList>
  );
}
