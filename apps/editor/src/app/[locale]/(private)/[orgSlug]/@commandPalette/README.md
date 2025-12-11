# Command Palette Architecture

This folder implements a global search feature (command palette) that works across all pages under the `[orgSlug]` route. It uses a Next.js pattern called [parallel routes](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes) to achieve this.

## The Problem

We need a search dialog that:

1. Opens with `Cmd+K` (or `Ctrl+K`) from any page
2. Searches courses using server-side data fetching (not client-side)
3. Persists the search query in the URL (e.g., `?q=react`)
4. Works on every page under `[orgSlug]` (home, settings, courses, etc.)

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
│  │ @commandPalette (this folder)   ││ ← Search dialog
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ children (main page content)    ││ ← Actual page
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

The key benefit: **parallel routes receive `searchParams`**, even though layouts don't.

## File Structure

```
@commandPalette/
├── page.tsx              # Handles the root route: /[orgSlug]
├── [...catchAll]/
│   └── page.tsx          # Handles all nested routes: /[orgSlug]/*
├── default.tsx           # Fallback when route state can't be determined
└── README.md             # This file
```

### Why the `[...catchAll]` folder?

Parallel routes must have a matching page for every route the user can visit. Without `[...catchAll]`:

- ✅ `/acme` works (matches `page.tsx`)
- ❌ `/acme/settings` breaks (no matching page)
- ❌ `/acme/courses/react` breaks (no matching page)

The `[...catchAll]` folder with `page.tsx` inside catches ALL nested paths, so the command palette works everywhere.

### Why `default.tsx`?

When Next.js does a full page reload (not client-side navigation), it needs to know what to render for each parallel route slot. The `default.tsx` file provides that fallback.

## How the Components Work Together

```
┌─────────────────────────────────────────────────────────────┐
│ CommandPaletteProvider (layout.tsx)                         │
│ - Provides open/close state via React Context               │
│ - Handles Cmd+K keyboard shortcut                           │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ CommandPaletteTrigger (navbar.tsx)                    │  │
│  │ - The search button in the navbar                     │  │
│  │ - Calls open() from context when clicked              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ @commandPalette/page.tsx (this parallel route)        │  │
│  │ - Receives searchParams from the URL                  │  │
│  │ - Renders CommandPaletteDialog with server data       │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ CommandPaletteDialog (client)                   │  │  │
│  │  │ - Reads isOpen from context                     │  │  │
│  │  │ - Updates URL query with nuqs                   │  │  │
│  │  │                                                 │  │  │
│  │  │  ┌───────────────────────────────────────────┐  │  │  │
│  │  │  │ CommandPaletteSearch (client)             │  │  │  │
│  │  │  │ - Input field that updates ?q= in URL     │  │  │  │
│  │  │  └───────────────────────────────────────────┘  │  │  │
│  │  │                                                 │  │  │
│  │  │  ┌───────────────────────────────────────────┐  │  │  │
│  │  │  │ CommandPaletteCourses (server)            │  │  │  │
│  │  │  │ - Fetches courses based on query          │  │  │  │
│  │  │  │ - Rendered on server, streamed to client  │  │  │  │
│  │  │  └───────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

1. User presses `Cmd+K` → `CommandPaletteProvider` sets `isOpen: true`
2. `CommandPaletteDialog` sees `isOpen` and shows the dialog
3. User types "react" → `CommandPaletteSearch` updates URL to `?q=react`
4. URL change triggers server re-render of `@commandPalette/page.tsx`
5. `page.tsx` reads `searchParams.q` and passes it to `CommandPaletteCourses`
6. `CommandPaletteCourses` fetches matching courses on the server
7. Results stream to the client and appear in the dialog

## Key Technologies

- **nuqs**: Library that syncs React state with URL query parameters
- **React Context**: Shares open/close state between navbar and dialog
- **Suspense**: Shows loading skeleton while courses are being fetched
- **Server Components**: Course fetching happens on the server, not client

## Adding New Searchable Items

To add more searchable content (e.g., chapters, lessons):

1. Create a new server component similar to `CommandPaletteCourses`
2. Add it to both `page.tsx` and `[...catchAll]/page.tsx`
3. Wrap it in `<Suspense>` with an appropriate skeleton

## Common Issues

### Search doesn't work on a new page

Make sure the `[...catchAll]/page.tsx` exists. It handles all nested routes.

### Dialog doesn't open

Check that the page is wrapped in `CommandPaletteProvider` (should be in `layout.tsx`).

### Search results are stale

The `nuqs` library has a `throttleMs` option (currently 300ms). Results update after the user stops typing.
