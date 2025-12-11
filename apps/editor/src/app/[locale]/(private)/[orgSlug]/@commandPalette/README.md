# Command Palette

This folder implements the command palette using Next.js parallel routes.

For detailed architecture documentation and implementation guide, see:
[`@zoonk/next` Command Palette README](../../../../../../../packages/next/src/patterns/command-palette/README.md)

## Quick Overview

- `page.tsx` - Handles the root route (`/[orgSlug]`)
- `[...catchAll]/page.tsx` - Handles all nested routes (`/[orgSlug]/*`)
- `default.tsx` - Fallback for hard navigation/refresh

## Related Files

- `../command-palette-provider.tsx` - Context provider wrapper
- `../command-palette-dialog.tsx` - Dialog with static pages
- `../command-palette-courses.tsx` - Server component for course search
