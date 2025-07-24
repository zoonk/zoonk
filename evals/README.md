# Zoonk AI Eval System

This system allows you to evaluate AI prompts across multiple models to detect regressions and test new models as they become available.

## Usage

### Evaluate a prompt across all models

```elixir
# Evaluate recommend_courses prompt with latest version across all models
Zoonk.AI.Evals.recommend_courses()

# Evaluate with a specific version
Zoonk.AI.Evals.recommend_courses("v2")
```

### Evaluate a prompt with a specific model

```elixir
# Evaluate recommend_courses prompt with a specific model
Zoonk.AI.Evals.recommend_courses("latest", "open/openai/gpt-4o")
```

### List available models

```elixir
Zoonk.AI.Evals.list_models()
```

## File Structure

The eval system creates the following directory structure:

```
evals/
├── prompts/
│   └── recommend_courses/
│       ├── latest.json
│       └── v2.json
└── outputs/
    └── recommend_courses/
        ├── latest/
        │   ├── openai_gpt-4o/
        │   │   ├── input_1.json
        │   │   ├── input_2.json
        │   │   └── ...
        │   ├── anthropic_claude-3-5-sonnet/
        │   │   ├── input_1.json
        │   │   └── ...
        │   └── ...
        └── v2/
            └── ...
```

### Prompt Files

Located at `evals/prompts/{prompt_name}/{version}.json`. Contains:

- `prompt_name`: Name of the prompt being evaluated
- `version`: Version identifier
- `test_cases`: Array of test cases with input and language
- `generated_at`: Timestamp when the file was created

### Output Files

Located at `evals/outputs/{prompt_name}/{version}/{model}/input_{index}.json`. Contains:

- `prompt_name`: Name of the prompt
- `version`: Version identifier
- `model`: Model that was used
- `case_index`: Index of the test case
- `result`: Contains the input, language, output/error, and status
- `generated_at`: Timestamp when the file was created

## Example

To run a full evaluation of the recommend_courses prompt:

```bash
# Start an IEx session
iex -S mix

# Run the evaluation
iex> Zoonk.AI.Evals.recommend_courses()
```

This will:

1. Create the directory structure
2. Save all test cases to `evals/prompts/recommend_courses/latest.json`
3. Run each test case against every model
4. Save results to `evals/outputs/recommend_courses/latest/{model}/input_{n}.json`

You can then analyze the results by examining the output files to compare responses across different models.
