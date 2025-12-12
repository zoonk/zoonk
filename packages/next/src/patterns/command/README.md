# Command Palette Pattern

A composable command palette with server-side search, URL state, and keyboard shortcuts.

## Quick Start

**For adding to an existing app**, you need:

1. A layout with `CommandPaletteProvider` and the trigger button
2. A parallel route `@commandPalette` to render the dialog
3. Search result components (we provide utilities to make this easy)

**For extending to new content types** (chapters, lessons, etc.), you only need to:

1. Create a search component (10-20 lines using our utilities)
2. Add it to your parallel route page

The pattern handles everything else: query validation, error handling, empty states, selection, and navigation.

## Key Concepts

### Parallel Routes

A **parallel route** (`@commandPalette`) renders alongside your page content:

```text
Layout
├── @commandPalette  ← Dialog with server-fetched results
└── children         ← Your main page content
```

**Why?** Parallel routes receive `searchParams`, letting you fetch search results on the server even though the dialog is global.

### Composable Search Components

Instead of duplicating code, use our utilities:

- `searchWithValidation()` - Handles query validation and errors
- `CommandPaletteResultsGroup` - Wraps results consistently
- `CommandPaletteResultsSkeleton` - Generic loading state
- `CommandPaletteItem` - Item with selection handling

## Creating Search Components

### Example: Courses Search

Here's a complete search component for courses (~30 lines):

```tsx
import { searchCourses } from "@zoonk/core/courses";
import { Badge } from "@zoonk/ui/components/badge";
import Image from "next/image";
import {
  CommandPaletteItem,
  CommandPaletteResultsGroup,
  CommandPaletteResultsSkeleton,
  searchWithValidation,
} from "@zoonk/next/patterns/command";

export async function CommandPaletteCourses({
  orgSlug,
  query,
  heading,
  getLinkUrl,
}: {
  orgSlug: string;
  query: string;
  heading: string;
  getLinkUrl: (slug: string) => string;
}) {
  // searchWithValidation handles query validation, errors, and empty results
  const courses = await searchWithValidation(query, () =>
    searchCourses({ orgSlug, title: query })
  );

  if (!courses) return null;

  return (
    <CommandPaletteResultsGroup heading={heading}>
      {courses.map((course) => (
        <CommandPaletteItem href={getLinkUrl(course.slug)} key={course.id}>
          <Image src={course.imageUrl} alt={course.title} /* ... */ />
          <span>{course.title}</span>
          <Badge>{course.language}</Badge>
        </CommandPaletteItem>
      ))}
    </CommandPaletteResultsGroup>
  );
}

export function CommandPaletteCoursesSkeleton() {
  return <CommandPaletteResultsSkeleton />;
}
```

**What's happening:**

1. `searchWithValidation()` validates the query and handles errors/empty results
2. `CommandPaletteResultsGroup` wraps items with a heading
3. `CommandPaletteItem` handles selection → closes dialog → navigates
4. `CommandPaletteResultsSkeleton` shows loading state

### Extending to Chapters

Adding chapter search is just as simple:

```tsx
export async function CommandPaletteChapters({
  courseId,
  query,
  heading,
  getLinkUrl,
}: {
  courseId: string;
  query: string;
  heading: string;
  getLinkUrl: (slug: string) => string;
}) {
  const chapters = await searchWithValidation(query, () =>
    searchChapters({ courseId, title: query })
  );

  if (!chapters) return null;

  return (
    <CommandPaletteResultsGroup heading={heading}>
      {chapters.map((chapter) => (
        <CommandPaletteItem href={getLinkUrl(chapter.slug)} key={chapter.id}>
          <span>{chapter.title}</span>
        </CommandPaletteItem>
      ))}
    </CommandPaletteResultsGroup>
  );
}

export function CommandPaletteChaptersSkeleton() {
  // No images for chapters, show 3 items
  return <CommandPaletteResultsSkeleton showImage={false} count={3} />;
}
```

**That's it!** No duplication of validation, error handling, or selection logic.

## Setup Guide

### 1. File Structure

```text
app/
  [locale]/
    (catalog)/                      # Your route group
      layout.tsx                    # Add provider + trigger
      command-palette-dialog.tsx    # Dialog wrapper (client)
      @commandPalette/
        page.tsx                    # Root route
        default.tsx                 # Fallback
        [...catchAll]/
          page.tsx                  # Catch-all for nested routes
```

### 2. Update Layout

Add the provider, trigger, and parallel route slot:

```tsx
// layout.tsx
import {
  CommandPaletteProvider,
  CommandPaletteTrigger,
} from "@zoonk/next/patterns/command";

type LayoutProps = {
  children: React.ReactNode;
  commandPalette: React.ReactNode; // Parallel route slot
};

export default function Layout({ children, commandPalette }: LayoutProps) {
  return (
    <CommandPaletteProvider>
      <nav>
        <CommandPaletteTrigger label="Search" />
      </nav>
      {children}
      {commandPalette}
    </CommandPaletteProvider>
  );
}
```

### 3. Create Dialog Wrapper

```tsx
// dialog.tsx
"use client";

import { CommandPaletteDialog } from "@zoonk/next/patterns/command";
import { HomeIcon } from "lucide-react";

const staticPages = [
  { icon: HomeIcon, label: "Home", url: "/" },
  { label: "About", url: "/about" },
];

export function MyCommandDialog({ children }: { children: React.ReactNode }) {
  return (
    <CommandPaletteDialog placeholder="Search..." staticPages={staticPages}>
      {children}
    </CommandPaletteDialog>
  );
}
```

### 4. Create Parallel Route Pages

```tsx
// @commandPalette/page.tsx
import { Suspense } from "react";
import { MyCommandDialog } from "../dialog";
import {
  CommandPaletteCourses,
  CommandPaletteCoursesSkeleton,
} from "../courses";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const { q } = await searchParams;

  return (
    <MyCommandDialog>
      <Suspense fallback={<CommandPaletteCoursesSkeleton />}>
        <CommandPaletteCourses query={q ?? ""} />
      </Suspense>
    </MyCommandDialog>
  );
}
```

```tsx
// @commandPalette/default.tsx
export default function Default() {
  return null;
}
```

```tsx
// @commandPalette/[...catchAll]/page.tsx
// Same as page.tsx (handles nested routes)
```

That's it! You now have a working command palette with search functionality.

## How It Works

1. User presses `Cmd+K` → Opens dialog
2. User types → Query updates in URL via `nuqs`
3. URL change → Server re-renders parallel route
4. Search component fetches data → Streams results to client
5. User selects item → Navigates and closes dialog

## Troubleshooting

**Dialog doesn't open**: Check that layout includes `CommandPaletteProvider` and `commandPalette` slot

**Search doesn't work**: Ensure `[...catchAll]/page.tsx` exists to handle nested routes

**TypeScript errors**: Layout must include parallel route in type: `{ commandPalette: React.ReactNode }`
