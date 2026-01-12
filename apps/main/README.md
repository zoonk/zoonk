# Main App

This is our main app available at [zoonk.com](https://www.zoonk.com). It allows anyone to learn anything using AI.

Check our [repo's README](../../README.md) for setup instructions.

## Environment Variables

Copy the `.env.example` file to `.env` and fill in the required environment variables:

```bash
cp .env.example .env
```

## File Structure

- `messages/`: i18n translation files
- `public/`: Static assets
- `src/`: Source code
  - `app/`: Next.js routes
  - `components/`: Cross-route-group shared components (domain organized)
  - `i18n/`: Internationalization setup
  - `lib/`: Shared utilities and constants
  - `proxy.ts`: Next.js Proxy setup
- `mdx-components.tsx`: MDX components mapping, see the [Next.js MDX docs](https://nextjs.org/docs/app/guides/mdx) for more info

## Inspecting Workflows

We use [Workflow](https://github.com/workflow-ai/workflow) to run background jobs or any durable tasks like AI generation. You can inspect the runs with the following commands:

```bash
pnpm workflow:inspect
# or for a web interface
pnpm workflow:web
```
