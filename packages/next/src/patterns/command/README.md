# Command Palette Pattern

A reusable command palette with URL-based search state using [nuqs](https://nuqs.dev) and Next.js parallel routes.

## Overview

This pattern provides a global search feature (command palette) that:

1. Opens with `Cmd+K` (or `Ctrl+K`) from any page
2. Searches content using server-side data fetching (not client-side)
3. Persists the search query in the URL (e.g., `?q=react`)
4. Works on every page within the route group

## The Problem

We need a search dialog that:

- Opens from anywhere in the app
- Fetches search results on the server, not the client
- Persists the search query in the URL for sharing/bookmarking
- Works across all pages in a route group

The challenge is that:

- Layouts don't have access to URL query parameters (`searchParams`)
- We want to fetch search results on the server, not the client
- The search dialog needs to be available on every page

## The Solution: Parallel Routes

A **parallel route** is a special folder that starts with `@` (like `@commandPalette`). It renders alongside the main page content, not instead of it.

Think of it like having two "slots" in the layout:

```
┌─────────────────────────────────────┐
│ Layout                              │
│  ┌─────────────────────────────────┐│
│  │ @commandPalette (parallel slot) ││ ← Search dialog
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ children (main page content)    ││ ← Actual page
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

The key benefit: **parallel routes receive `searchParams`**, even though layouts don't.

## Components

### CommandPaletteProvider

Context provider that manages open/close state and keyboard shortcuts.

```tsx
import { CommandPaletteProvider } from "@zoonk/next/patterns/command";

function Layout({ children }) {
  return <CommandPaletteProvider>{children}</CommandPaletteProvider>;
}
```

**Props:**

- `children` - React children
- `shortcutKey` - Keyboard shortcut key (default: `"k"`)

The provider also wraps children with `NuqsAdapter` for URL state management.

### useCommandPalette

Hook to access command palette state.

```tsx
import { useCommandPalette } from "@zoonk/next/patterns/command";

function MyComponent() {
  const { isOpen, open, close } = useCommandPalette();
  // ...
}
```

### CommandPaletteTrigger

Button to open the command palette.

```tsx
import { CommandPaletteTrigger } from "@zoonk/next/patterns/command";

function Navbar() {
  return <CommandPaletteTrigger label="Search" />;
}
```

**Props:**

- `label` - Accessible label for screen readers (required)

### CommandPaletteSearch

Search input that syncs with URL query parameters.

```tsx
import { CommandPaletteSearch } from "@zoonk/next/patterns/command";

function MyDialog() {
  return <CommandPaletteSearch placeholder="Search..." queryParam="q" />;
}
```

**Props:**

- `placeholder` - Input placeholder (default: `"Search..."`)
- `queryParam` - URL query parameter name (default: `"q"`)
- `throttleMs` - Throttle delay for URL updates (default: `300`)

### CommandPaletteDialog

Complete dialog with search input, static pages filtering, and slots for server-fetched results.

```tsx
import { CommandPaletteDialog } from "@zoonk/next/patterns/command";
import { HomeIcon, SettingsIcon } from "lucide-react";

function MyPalette({ children }) {
  const router = useRouter();

  const staticPages = [
    { icon: HomeIcon, label: "Home", url: "/" },
    { icon: SettingsIcon, label: "Settings", url: "/settings" },
  ];

  return (
    <CommandPaletteDialog
      labels={{
        close: "Close",
        description: "Search...",
        emptyText: "No results found",
        pagesHeading: "Pages",
        placeholder: "Search...",
        title: "Search",
      }}
      onSelect={(url) => router.push(url)}
      staticPages={staticPages}
    >
      {children}
    </CommandPaletteDialog>
  );
}
```

**Props:**

- `children` - Content (typically server-fetched `CommandGroup` components)
- `labels` - Object with localized labels
- `onSelect` - Callback when an item is selected
- `queryParam` - URL query parameter (default: `"q"`)
- `staticPages` - Array of static pages to filter and display

## Implementation Guide

### 1. Create the parallel route structure

```
app/
  [locale]/
    (routeGroup)/
      layout.tsx                    # Renders children + commandPalette slot
      page.tsx                      # Main page content
      command-palette-provider.tsx  # Client wrapper for provider
      command-palette-trigger.tsx   # Client trigger button
      command-palette-dialog.tsx    # Client dialog with static pages
      command-palette-results.tsx   # Server component for search results
      @commandPalette/
        page.tsx                    # Handles root route
        default.tsx                 # Fallback for hard navigation
        [...catchAll]/
          page.tsx                  # Handles all nested routes
```

### 2. Create the provider wrapper

```tsx
// command-palette-provider.tsx
"use client";

import { CommandPaletteProvider } from "@zoonk/next/patterns/command";

export function MyCommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CommandPaletteProvider>{children}</CommandPaletteProvider>;
}
```

### 3. Create the trigger wrapper (with localization)

```tsx
// command-palette-trigger.tsx
"use client";

import { CommandPaletteTrigger } from "@zoonk/next/patterns/command";
import { useTranslations } from "next-intl";

export function MyCommandPaletteTrigger() {
  const t = useTranslations();
  return <CommandPaletteTrigger label={t("Search")} />;
}
```

### 4. Create the dialog wrapper (with static pages)

```tsx
// command-palette-dialog.tsx
"use client";

import { CommandPaletteDialog } from "@zoonk/next/patterns/command";
import { HomeIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export function MyCommandPaletteDialog({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const t = useTranslations();

  const staticPages = [
    { icon: HomeIcon, label: t("Home"), url: "/" },
    // Add more static pages...
  ];

  return (
    <CommandPaletteDialog
      labels={{
        close: t("Close"),
        emptyText: t("No results"),
        placeholder: t("Search..."),
        title: t("Search"),
      }}
      onSelect={(url) => router.push(url)}
      staticPages={staticPages}
    >
      {children}
    </CommandPaletteDialog>
  );
}
```

### 5. Create the server results component

```tsx
// command-palette-results.tsx
import { CommandGroup, CommandItem } from "@zoonk/ui/components/command";

type ResultsProps = {
  query: string;
};

export async function CommandPaletteResults({ query }: ResultsProps) {
  if (!query.trim()) return null;

  const results = await searchSomething(query);

  if (results.length === 0) return null;

  return (
    <CommandGroup heading="Results">
      {results.map((item) => (
        <CommandItem key={item.id} value={item.url}>
          {item.title}
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

export function CommandPaletteResultsSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="h-4 w-16 animate-pulse rounded bg-muted" />
      <div className="h-8 animate-pulse rounded bg-muted" />
      <div className="h-8 animate-pulse rounded bg-muted" />
    </div>
  );
}
```

### 6. Update the layout

```tsx
// layout.tsx
import { MyCommandPaletteProvider } from "./command-palette-provider";
import { MyCommandPaletteTrigger } from "./command-palette-trigger";

type LayoutProps = {
  children: React.ReactNode;
  commandPalette: React.ReactNode; // The parallel route slot
};

export default function Layout({ children, commandPalette }: LayoutProps) {
  return (
    <MyCommandPaletteProvider>
      <nav>
        <MyCommandPaletteTrigger />
      </nav>
      {children}
      {commandPalette}
    </MyCommandPaletteProvider>
  );
}
```

### 7. Create the parallel route page

```tsx
// @commandPalette/page.tsx
import { Suspense } from "react";
import { MyCommandPaletteDialog } from "../command-palette-dialog";
import {
  CommandPaletteResults,
  CommandPaletteResultsSkeleton,
} from "../command-palette-results";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function CommandPalettePage({ searchParams }: Props) {
  const { q } = await searchParams;

  return (
    <MyCommandPaletteDialog>
      <Suspense fallback={<CommandPaletteResultsSkeleton />}>
        <CommandPaletteResults query={q ?? ""} />
      </Suspense>
    </MyCommandPaletteDialog>
  );
}
```

### 8. Create the catch-all for nested routes

```tsx
// @commandPalette/[...catchAll]/page.tsx
// Duplicate the same content as page.tsx
// (Required because parallel routes must match all possible routes)
```

### 9. Create the default fallback

```tsx
// @commandPalette/default.tsx
// Duplicate the same content as page.tsx
// (Required for hard navigation/refresh scenarios)
```

## Data Flow

1. User presses `Cmd+K` → `CommandPaletteProvider` sets `isOpen: true`
2. `CommandPaletteDialog` sees `isOpen` and shows the dialog
3. User types "react" → `CommandPaletteSearch` updates URL to `?q=react`
4. URL change triggers server re-render of `@commandPalette/page.tsx`
5. `page.tsx` reads `searchParams.q` and passes it to results component
6. Results component fetches matching data on the server
7. Results stream to the client and appear in the dialog

## Key Technologies

- **nuqs**: Library that syncs React state with URL query parameters
- **React Context**: Shares open/close state between navbar and dialog
- **Suspense**: Shows loading skeleton while results are being fetched
- **Server Components**: Data fetching happens on the server, not client

## Common Issues

### Search doesn't work on a new page

Make sure the `[...catchAll]/page.tsx` exists. It handles all nested routes.

### Dialog doesn't open

Check that the page is wrapped in `CommandPaletteProvider` (should be in layout).

### Search results are stale

The `nuqs` library has a `throttleMs` option (default 300ms). Results update after the user stops typing.

### TypeScript errors with parallel routes

Make sure your layout type includes the parallel route slot:

```tsx
type LayoutProps = {
  children: React.ReactNode;
  commandPalette: React.ReactNode;
};
```
