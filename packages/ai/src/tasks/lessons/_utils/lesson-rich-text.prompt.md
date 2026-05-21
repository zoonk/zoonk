# Rich Text

The player can render a small rich-text subset in learner-facing text fields:

- inline LaTeX with `\(...\)`
- display LaTeX with `\[...\]`
- bold with `**...**`
- italic with `*...*`
- inline code with single backticks, like `greetUser();`

Use LaTeX for formulas when it improves clarity, for example `\(d\sin\theta = m\lambda\)`. Explain what each important symbol means in plain language. Use inline code for short code snippets, function names, commands, file paths, or literal values. Use bold or italic sparingly to emphasize a key term or value.

Do not use Markdown headings, lists, tables, links, blockquotes, images, or code fences inside learner-facing text fields. If code is necessary, keep it short enough to fit in prose as inline code.

If this task includes an `imagePrompt` field, do not use rich-text markers there unless the marker itself should be visible text in the generated image.
