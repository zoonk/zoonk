defmodule Zoonk.AI.Evals do
  @moduledoc """
  Local evaluation system for AI prompts.

  This module provides functionality to evaluate AI prompts
  across multiple models to detect regressions and test
  new models as they become available.
  """

  alias Zoonk.AI.Evals.EvalFiles
  alias Zoonk.AI.Evals.EvalRunner

  @doc """
  Generate outputs for all models.

  For generating outputs for a specific model,
  use `generate_object/3`.

  ## Examples

      iex> generate_object(:recommend_courses, :model)
      :ok
  """
  @spec generate_object(atom(), EvalFiles.eval_type()) :: :ok
  defdelegate generate_object(prompt, eval_type), to: EvalRunner

  @doc """
  Generate outputs for a prompt.

  We use these outputs to compare the performance of
  different models and prompt versions.

  This function will store outputs in `priv/evals`,
  allowing us to compare them later and run evaluations.

  For generating objects for all supported models,
  use `generate_object/2`.

  ## Examples

      iex> generate_object(:recommend_courses, :model, "gpt-4.1-nano")
      {:ok, output}
  """
  @spec generate_object(atom(), EvalFiles.eval_type(), String.t()) :: :ok
  defdelegate generate_object(prompt, eval_type, model), to: EvalRunner
end
