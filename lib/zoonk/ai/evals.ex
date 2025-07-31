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
  use `generate_output/3`.

  ## Examples

      iex> generate_output(:recommend_courses, :model)
      :ok
  """
  @spec generate_output(atom(), EvalFiles.eval_type()) :: :ok
  def generate_output(prompt, eval_type) do
    EvalRunner.generate_object(prompt, eval_type)
  end

  @doc """
  Generate outputs for a prompt.

  We use these outputs to compare the performance of
  different models and prompt versions.

  This function will store outputs in `priv/evals`,
  allowing us to compare them later and run evaluations.

  For generating outputs for all supported models,
  use `generate_output/2`.

  ## Examples

      iex> generate_output(:recommend_courses, :model, "gpt-4.1-nano")
      {:ok, output}
  """
  @spec generate_output(atom(), EvalFiles.eval_type(), String.t()) :: :ok
  def generate_output(prompt, eval_type, model) do
    EvalRunner.generate_object(prompt, eval_type, model)
  end
end
