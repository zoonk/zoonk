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
  - `app`: Next.js routes
  - `blocks`: UI blocks
  - `hooks`: Reusable React hooks
  - `i18n`: Internationalization setup
  - `lib`: Constants, utilities, and helper functions
  - `proxy.ts`: Next.js Proxy setup
- `test/`: Test utilities and mocks
- `components.json`: shadcn configuration
- `mdx-components.tsx`: MDX components mapping, see the [Next.js MDX docs](https://nextjs.org/docs/app/guides/mdx) for more info
