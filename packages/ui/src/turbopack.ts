/** Turbopack resolves loaders from the app, so every app that uses these rules lists `@tailwindcss/turbopack`. */
export const tailwindRules = { "*.css": { as: "*.css", loaders: ["@tailwindcss/turbopack"] } };
