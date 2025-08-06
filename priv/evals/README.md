# Evaluation Results

This directory contains the evaluation results for various AI models and prompts.

## Running Evaluations

First, you need to run an evaluation. There are two evaluation types:

- `model`: Meant to test model capabilities for a specific prompt. This will usually test a small set of test cases (e.g. 3-5 cases).
- `prompt`: Meant to test prompt performance across a larger set of test cases (e.g. 50-100 cases). This is useful for catching regressions and measuring improvements.

For a `model` evaluation, run:

```elixir
Zoonk.AI.Evals.generate_object(:recommend_courses, :model, "openai/gpt-4.1")
Zoonk.AI.Evals.update_leaderboard(:recommend_courses, "openai/gpt-4.1")
```

For a `prompt` evaluation, run:

```elixir
Zoonk.AI.Evals.generate_object(:recommend_courses, :prompt, "openai/gpt-4.1")
Zoonk.AI.Evals.calculate_score(:recommend_courses)
```

## Prompts

- [Recommend Courses](recommend_courses.md): We ask users what they want to learn and recommend courses accordingly.
