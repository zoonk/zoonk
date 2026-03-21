Create a data visualization chart.

Use when: The step discusses **real numerical data** — actual statistics, measurements, well-known mathematical relationships, or values derived from established formulas.

## When NOT to use charts

- **Never invent data.** If the step describes a concept qualitatively (e.g., "rehashing reduces conflicts") but gives no specific numbers, do NOT fabricate values to fill a chart. Use a table or diagram instead.
- **Never use charts for conceptual comparisons.** "Before vs. after", "fast vs. slow", "good vs. bad" — these are qualitative and belong in a **table** (for structured comparison) or a **diagram** (for showing relationships).
- **Never use charts when the numbers have no units or meaning.** Every value in a chart must represent something concrete that the reader can interpret (e.g., "milliseconds", "% of capacity", "number of probes"). If you can't explain what the y-axis measures, don't use a chart.
- **Never chart a tautology.** If the data points simply restate the axis labels in a different format, the chart adds no information. Use a table instead. Common tautologies to avoid:
  - Plotting y=x to show "linear growth" (e.g., n=1→1, n=2→2, n=3→3 — this is just the identity function)
  - Plotting a unit conversion (e.g., "200% = 2x factor")
  - Plotting input size vs. input size with a different label
  - If every y-value equals its x-value or a trivial multiple of it, it's a tautology

## When to use charts

- The step mentions specific numbers, percentages, or measurements
- The data comes from a well-known formula or mathematical relationship (e.g., expected probes vs. load factor in hash tables: `1/(1-α)`)
- The step references real-world statistics or benchmarks
- The trend or distribution is the main teaching point, not just a side illustration

## Requirements

- Choose chart type based on the data:
  - bar: comparing categories with concrete values
  - line: showing trends where the x-axis is a continuous or ordered numeric dimension (time, load percentage, input size) — NOT arbitrary categories
  - pie: showing proportions of a whole (parts must sum to 100%)
- Title max 50 chars
- 4-8 data points for optimal clarity
- Every data point must be grounded in real or mathematically derived values — never arbitrary
