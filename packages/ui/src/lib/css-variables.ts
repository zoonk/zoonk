export type CSSPropertiesWithVariables = React.CSSProperties &
  Record<`--${string}`, string | number>;
