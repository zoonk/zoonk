# Zoonk tsconfig

This package contains all base TypeScript configurations used across Zoonk packages and apps.

## Usage

You can extend the base configurations in your `tsconfig.json` files like so:

```json
{
  "extends": "@zoonk/tsconfig/base.json",
  "compilerOptions": {
    // Your custom compiler options here
  }
}
```

## Available Configurations

- `base.json`: The base TypeScript configuration with common settings.
- `next.json`: Configuration tailored for Next.js projects.
- `react-library.json`: Configuration for React libraries.
