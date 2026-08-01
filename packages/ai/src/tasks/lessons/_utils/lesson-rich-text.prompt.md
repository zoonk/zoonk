# Rich Text

The player can render a small rich-text subset in learner-facing text fields:

- inline LaTeX with `\(...\)`
- display LaTeX with `\[...\]`
- bold with `**...**`
- italic with `*...*`
- inline code with single backticks, like `greetUser();`

Use LaTeX for formulas when it improves clarity, for example `\(d\sin\theta = m\lambda\)`. Explain what each important symbol means in plain language. Use inline code for short code snippets, function names, commands, file paths, or literal values. Use bold or italic sparingly to emphasize a key term or value.

The response is structured JSON, so escape every LaTeX backslash correctly in the raw JSON string. To produce parsed learner text such as `\(\theta\)`, the raw JSON must contain `\\(\\theta\\)`. Never write an invalid raw JSON escape such as `\(`, and never use `\0`, `\b`, `\u0000`, another control character, or an invisible separator as a workaround. In the parsed learner text, the backslash must be the first character of each `\(`, `\)`, `\[`, or `\]` delimiter.

Before returning, inspect every learner-facing string for characters from `U+0000` through `U+001F`. No such control character is allowed inside a title or text field.

Do not use Markdown headings, lists, tables, links, blockquotes, images, or code fences inside learner-facing text fields. If code is necessary, keep it short enough to fit in prose as inline code.

If this task includes an `imagePrompt` field, do not use rich-text markers there unless the marker itself should be visible text in the generated image.
