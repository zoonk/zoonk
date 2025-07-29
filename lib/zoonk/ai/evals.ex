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
  Generate outputs for a prompt.

  We use these outputs to compare the performance of
  different models and prompt versions.

  This function will store outputs in `priv/evals`,
  allowing us to compare them later and run evaluations.

  ## Examples

      iex> generate_output(:recommend_courses, "gpt-4.1-nano", :model)
      {:ok, output}
  """
  @spec generate_output(atom(), String.t(), EvalFiles.output_type()) :: :ok
  def generate_output(prompt, model, output_type) do
    EvalRunner.generate_object(prompt, output_type, model)
  end
end
