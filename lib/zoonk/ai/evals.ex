defmodule Zoonk.AI.Evals do
  @moduledoc """
  Local evaluation system for AI prompts.

  This module provides functionality to evaluate AI prompts across multiple
  models to detect regressions and test new models as they become available.
  """
  alias Zoonk.AI.Tasks.RecommendCourses

  require Logger

  @doc """
  Evaluates the recommend_courses prompt across all models.

  ## Parameters

  - `version` - Version identifier for the prompt (defaults to "latest")

  ## Examples

      iex> Evals.recommend_courses()
      :ok

      iex> Evals.recommend_courses("v2")
      :ok
  """
  def recommend_courses(version \\ "latest") do
    Logger.info("Evaluating recommend_courses prompt for version: #{version}")

    models = list_models()

    for model <- models do
      recommend_courses(version, model.name)
    end

    :ok
  end

  @doc """
  Evaluates the recommend_courses prompt for a specific model.

  ## Parameters

  - `version` - Version identifier for the prompt
  - `model` - Model to evaluate against

  ## Examples

      iex> Evals.recommend_courses("latest", "open/openai/gpt-4o")
      :ok
  """
  def recommend_courses(version, model) do
    Logger.info("Evaluating recommend_courses prompt for model: #{model}, version: #{version}")

    test_cases = get_recommend_courses_test_cases()

    # Save prompt inputs to disk
    save_prompt_inputs("recommend_courses", version, test_cases)

    # Run evaluations for each test case
    test_cases
    |> Enum.with_index(1)
    |> Enum.each(fn {%{input: input, language: language}, index} ->
      Logger.info("Evaluating case #{index} for model #{model}: #{input}")

      case RecommendCourses.recommend_eval(input, language, model) do
        {:ok, result} ->
          Logger.info("Case #{index} succeeded for model #{model}")

          save_output("recommend_courses", version, model, index, %{
            input: input,
            language: language,
            output: result,
            status: :success
          })

        {:error, error} ->
          Logger.error("Case #{index} failed for model #{model}: #{inspect(error)}")

          save_output("recommend_courses", version, model, index, %{
            input: input,
            language: language,
            error: error,
            status: :error
          })
      end
    end)

    :ok
  end

  # Private functions

  defp get_recommend_courses_test_cases do
    [
      # English test cases
      %{input: "I want to learn programming", language: "en"},
      %{input: "data science and machine learning", language: "en"},
      %{input: "how to build mobile apps", language: "en"},
      %{input: "UI/UX design", language: "en"},
      %{input: "digital marketing", language: "en"},
      %{input: "artificial intelligence", language: "en"},
      %{input: "web development", language: "en"},
      %{input: "cybersecurity", language: "en"},
      %{input: "financial planning", language: "en"},
      %{input: "project management", language: "en"},

      # Portuguese test cases
      %{input: "Quero aprender programação", language: "pt"},
      %{input: "ciência de dados", language: "pt"},
      %{input: "desenvolvimento web", language: "pt"},
      %{input: "marketing digital", language: "pt"},
      %{input: "inteligência artificial", language: "pt"},

      # Spanish test cases
      %{input: "desarrollo de aplicaciones móviles", language: "es"},
      %{input: "diseño gráfico", language: "es"},
      %{input: "marketing digital", language: "es"},

      # French test cases
      %{input: "apprentissage automatique", language: "fr"},
      %{input: "développement web", language: "fr"},

      # Edge cases
      %{
        input: "I want to learn everything about quantum physics and advanced mathematics and computer science",
        language: "en"
      }
    ]
  end

  defp save_prompt_inputs(prompt_name, version, test_cases) do
    inputs = %{
      prompt_name: prompt_name,
      version: version,
      test_cases: test_cases,
      generated_at: DateTime.utc_now()
    }

    file_path = Path.join(["evals", "prompts", "#{prompt_name}", "#{version}.json"])
    ensure_directory_exists(file_path)
    File.write!(file_path, Jason.encode!(inputs, pretty: true))
  end

  defp save_output(prompt_name, version, model, case_index, result) do
    # Convert model name to filesystem-safe format and remove open/ prefix
    model_dir =
      model
      |> String.replace_prefix("open/", "")
      |> String.replace("/", "_")

    output_data = %{
      prompt_name: prompt_name,
      version: version,
      model: model,
      case_index: case_index,
      result: result,
      generated_at: DateTime.utc_now()
    }

    file_path =
      Path.join([
        "evals",
        "outputs",
        prompt_name,
        version,
        model_dir,
        "input_#{case_index}.json"
      ])

    ensure_directory_exists(file_path)
    File.write!(file_path, Jason.encode!(output_data, pretty: true))
  end

  defp ensure_directory_exists(file_path) do
    file_path
    |> Path.dirname()
    |> File.mkdir_p!()
  end

  @doc """
  Lists all models available for evaluation.

  Returns a list of OpenRouter model names.
  """
  def list_models do
    # styler:sort
    [
      %{name: "o3", input: 2, output: 8},
      %{name: "o3-pro", input: 20, output: 80},
      %{name: "o4-mini", input: 1.1, output: 4.4},
      %{name: "open/anthropic/claude-3.5-haiku", input: 0.8, output: 4},
      %{name: "open/anthropic/claude-3.7-sonnet:thinking", input: 3, output: 15},
      %{name: "open/anthropic/claude-opus-4", input: 15, output: 75},
      %{name: "open/anthropic/claude-sonnet-4", input: 3, output: 15},
      %{name: "open/deepseek/deepseek-chat-v3-0324:free", input: 0.25, output: 0.85},
      %{name: "open/deepseek/deepseek-r1-0528-qwen3-8b:free", input: 0.01, output: 0.02},
      %{name: "open/deepseek/deepseek-r1-0528:free", input: 0.272, output: 0.272},
      %{name: "open/deepseek/deepseek-r1:free", input: 0.4, output: 2},
      %{name: "open/google/gemini-2.0-flash-lite-001", input: 0.075, output: 0.3},
      %{name: "open/google/gemini-2.5-flash", input: 0.3, output: 2.5},
      %{name: "open/google/gemini-2.5-flash-lite", input: 0.1, output: 0.4},
      %{name: "open/google/gemini-2.5-pro", input: 1.25, output: 10},
      %{name: "open/google/gemma-2-9b-it:free", input: 0.004, output: 0.004},
      %{name: "open/google/gemma-3-12b-it:free", input: 0.03, output: 0.03},
      %{name: "open/google/gemma-3-27b-it:free", input: 0.09, output: 0.17},
      %{name: "open/meta-llama/llama-3.2-3b-instruct:free", input: 0.003, output: 0.006},
      %{name: "open/meta-llama/llama-3.3-70b-instruct:free", input: 0.038, output: 0.12},
      %{name: "open/meta-llama/llama-4-maverick", input: 0.15, output: 0.6},
      %{name: "open/meta-llama/llama-4-scout", input: 0.08, output: 0.3},
      %{name: "open/mistralai/mistral-medium-3", input: 0.4, output: 2},
      %{name: "open/mistralai/mistral-nemo:free", input: 0.008, output: 0.05},
      %{name: "open/mistralai/mistral-small-3.2-24b-instruct:free", input: 0.05, output: 0.1},
      %{name: "open/moonshotai/kimi-k2:free", input: 0.14, output: 2.49},
      %{name: "open/openai/gpt-4.1", input: 2, output: 8},
      %{name: "open/openai/gpt-4.1-mini", input: 0.4, output: 1.6},
      %{name: "open/openai/gpt-4.1-nano", input: 0.1, output: 0.4},
      %{name: "open/openai/gpt-4o", input: 2.5, output: 10},
      %{name: "open/openai/gpt-4o-mini", input: 0.15, output: 0.6},
      %{name: "open/openrouter/auto", input: 0, output: 0},
      %{name: "open/qwen/qwen3-235b-a22b-07-25:free", input: 0.12, output: 0.59},
      %{name: "open/tngtech/deepseek-r1t2-chimera:free", input: 0.302, output: 0.302},
      %{name: "open/x-ai/grok-3-mini", input: 0.3, output: 0.5},
      %{name: "open/x-ai/grok-4", input: 3, output: 15}
    ]
  end
end
