# Evaluation Results

This directory contains the evaluation results for various AI models and prompts.

## Running Evaluations

For evaluating a specific model, run:

```elixir
Zoonk.AI.Evals.evaluate_model(:suggest_courses, "openai/gpt-4.1")
```

For evaluating all models, run:

```elixir
Zoonk.AI.Evals.evaluate_models(:suggest_courses)
```

You can also pass an additional argument to evaluate only models from a specific pricing tier:

```elixir
Zoonk.AI.Evals.evaluate_models(:suggest_courses, :cheap)
Zoonk.AI.Evals.evaluate_models(:suggest_courses, :mid)
Zoonk.AI.Evals.evaluate_models(:suggest_courses, :expensive)
```

## Prompts

- [Suggest Courses](suggest_courses.md): We ask users what they want to learn and suggest courses accordingly.
