defmodule Zoonk.AI.Evals.EvalModels do
  @moduledoc """
  Evaluation models for AI tasks.
  """

  # styler:sort
  @models [
    %{name: "deepseek/deepseek-chat-v3-0324:free", input: 0.25, output: 0.85},
    %{name: "deepseek/deepseek-r1-0528:free", input: 0.272, output: 0.272},
    %{name: "deepseek/deepseek-r1:free", input: 0.4, output: 2},
    %{name: "google/gemini-2.0-flash-lite-001", input: 0.075, output: 0.3},
    %{name: "google/gemini-2.5-flash", input: 0.3, output: 2.5},
    %{name: "google/gemini-2.5-flash-lite", input: 0.1, output: 0.4},
    %{name: "google/gemini-2.5-pro", input: 1.25, output: 10},
    %{name: "meta-llama/llama-4-maverick", input: 0.15, output: 0.6},
    %{name: "meta-llama/llama-4-scout", input: 0.08, output: 0.3},
    %{name: "mistralai/mistral-medium-3.1", input: 0.4, output: 2},
    %{name: "mistralai/mistral-nemo:free", input: 0.008, output: 0.05},
    %{name: "mistralai/mistral-small-3.2-24b-instruct:free", input: 0.05, output: 0.1},
    %{name: "o3", input: 2, output: 8},
    %{name: "o3-pro", input: 20, output: 80},
    %{name: "openai/gpt-4.1", input: 2, output: 8},
    %{name: "openai/gpt-4.1-mini", input: 0.4, output: 1.6},
    %{name: "openai/gpt-4.1-nano", input: 0.1, output: 0.4},
    %{name: "openai/gpt-4o", input: 2.5, output: 10},
    %{name: "openai/gpt-4o-mini", input: 0.15, output: 0.6},
    %{name: "openai/gpt-5", input: 1.25, output: 10},
    %{name: "openai/gpt-5-chat", input: 1.25, output: 10},
    %{name: "openai/gpt-5-mini", input: 0.25, output: 2},
    %{name: "openai/gpt-5-nano", input: 0.05, output: 0.4},
    %{name: "openai/gpt-oss-120b", input: 0.073, output: 0.29},
    %{name: "openai/gpt-oss-20b:free", input: 0.04, output: 0.16},
    %{name: "openai/o4-mini", input: 1.1, output: 4.4},
    %{name: "openrouter/auto", input: 0, output: 0},
    %{name: "qwen/qwen3-235b-a22b-07-25:free", input: 0.12, output: 0.59},
    %{name: "tngtech/deepseek-r1t2-chimera:free", input: 0.302, output: 0.302},
    %{name: "x-ai/grok-3-mini", input: 0.3, output: 0.5},
    %{name: "x-ai/grok-4", input: 3, output: 15}
  ]

  @models_by_name Map.new(@models, &{&1.name, &1})

  @doc """
  Supported models for evaluation.

  Returns a list of models we're evaluating against.

  Each model also contains `input` and `output` costs.
  We use these to calculate the total cost of running a task.
  """
  def list_models, do: @models

  @doc """
  Get information about a specific model.

  ## Examples
      iex> get_model("openai/gpt-4.1")
      %{name: "openai/gpt-4.1", input: 2, output: 8}
  """
  def get_model(model_name), do: Map.get(@models_by_name, model_name)
end
