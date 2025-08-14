# Evaluation Results

This directory contains the evaluation results for various AI models and prompts.

## Running Evaluations

First, you need to run an evaluation. There are two evaluation types:

- `model`: Meant to test model capabilities for a specific prompt. This will usually test a small set of test cases (e.g. 3-5 cases).
- `prompt`: Meant to test prompt performance across a larger set of test cases (e.g. 20-50 cases). This is useful for catching regressions and measuring improvements.

For a `model` evaluation, run:

```elixir
Zoonk.AI.Evals.evaluate_model(:suggest_courses, "openai/gpt-4.1")
```

For a `prompt` evaluation, run:

```elixir
Zoonk.AI.Evals.evaluate_prompt(:suggest_courses, "openai/gpt-4.1")
```

## Prompts

- [Suggest Courses](suggest_courses.md): We ask users what they want to learn and suggest courses accordingly.
