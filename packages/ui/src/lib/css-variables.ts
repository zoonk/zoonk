/**
 * CSS properties type that allows custom CSS variables.
 * Use this instead of `as React.CSSProperties` when setting CSS custom properties.
 */
export type CSSPropertiesWithVariables = React.CSSProperties & {
  [key: `--${string}`]: string | number;
};
