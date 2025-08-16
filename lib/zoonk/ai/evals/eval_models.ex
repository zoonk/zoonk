defmodule Zoonk.AI.Evals.EvalModels do
  @moduledoc """
  Evaluation models for AI tasks.
  """

  @type tier :: :cheap | :mid | :expensive

  # styler:sort
  @models [
    %{name: "deepseek/deepseek-r1", input: 0.4, output: 2, tier: :mid},
    %{name: "google/gemini-2.5-flash", input: 0.3, output: 2.5, tier: :mid},
    %{name: "google/gemini-2.5-flash-lite", input: 0.1, output: 0.4, tier: :cheap},
    %{name: "google/gemini-2.5-pro", input: 1.25, output: 10, tier: :expensive},
    %{name: "gpt-5", input: 1.25, output: 10, tier: :expensive},
    %{name: "meta-llama/llama-4-maverick", input: 0.15, output: 0.6, tier: :cheap},
    %{name: "meta-llama/llama-4-scout", input: 0.08, output: 0.3, tier: :cheap},
    %{name: "mistralai/mistral-medium-3.1", input: 0.4, output: 2, tier: :cheap},
    %{name: "mistralai/mistral-small-3.2-24b-instruct", input: 0.05, output: 0.1, tier: :cheap},
    %{name: "o3", input: 2, output: 8, tier: :expensive},
    %{name: "openai/gpt-4.1", input: 2, output: 8, tier: :mid},
    %{name: "openai/gpt-4.1-mini", input: 0.4, output: 1.6, tier: :cheap},
    %{name: "openai/gpt-4.1-nano", input: 0.1, output: 0.4, tier: :cheap},
    %{name: "openai/gpt-4o", input: 2.5, output: 10, tier: :mid},
    %{name: "openai/gpt-4o-mini", input: 0.15, output: 0.6, tier: :cheap},
    %{name: "openai/gpt-5-mini", input: 0.25, output: 2, tier: :mid},
    %{name: "openai/gpt-5-nano", input: 0.05, output: 0.4, tier: :mid},
    %{name: "openai/o4-mini", input: 1.1, output: 4.4, tier: :expensive},
    %{name: "qwen/qwen3-235b-a22b-07-25", input: 0.12, output: 0.59, tier: :cheap}
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
  Filters models by tier.
  """
  def list_models(tier) do
    Enum.filter(@models, fn model -> model.tier == tier end)
  end

  @doc """
  Get information about a specific model.

  ## Examples
      iex> get_model("openai/gpt-4.1")
      %{name: "openai/gpt-4.1", input: 2, output: 8}
  """
  def get_model(model_name), do: Map.get(@models_by_name, model_name)
end
