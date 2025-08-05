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

  @doc """
  Calculate the average score for a prompt.

  This function loads all score files for a prompt, calculates
  the average and median scores across all evaluation steps,
  and updates the markdown file with the results.

  ## Examples

      iex> calculate_score(:recommend_courses)
      :ok
  """
  @spec calculate_score(atom() | String.t()) :: :ok
  def calculate_score(prompt_name) do
    prompt_name
    |> EvalFiles.load_prompt_outputs()
    |> calculate_scores()
    |> EvalFiles.update_scores_markdown(prompt_name)
  end

  defp calculate_scores(files) when is_list(files) do
    files
    |> extract_scores()
    |> summarize_scores()
  end

  defp extract_scores(files) do
    for %{"steps" => steps} <- files,
        %{"score" => score} when is_number(score) <- steps,
        do: score
  end

  defp summarize_scores([]), do: %{average: 0.0, median: 0.0}

  defp summarize_scores(scores) do
    %{average: average(scores), median: median(scores)}
  end

  defp average(scores) do
    Float.round(Enum.sum(scores) / length(scores), 2)
  end

  defp median(scores) do
    scores
    |> Enum.sort()
    |> calculate_median()
    |> Float.round(2)
  end

  defp calculate_median([]), do: 0.0

  defp calculate_median([single_value]), do: single_value * 1.0

  defp calculate_median(sorted_scores), do: advance_to_middle(sorted_scores, sorted_scores, nil)

  # Move two steps on the fast list and one on the slow list until the middle
  # previous holds the element just before the current slow head (for even lengths)
  defp advance_to_middle([current | remaining_slow], [_fast_head1, _fast_head2 | remaining_fast], _previous_middle) do
    advance_to_middle(remaining_slow, remaining_fast, current)
  end

  # Odd length: fast list has one element left; current is the median
  defp advance_to_middle([middle | _remaining_slow], [_fast_head], _previous), do: middle * 1.0

  # Even length: fast list exhausted; average the two middle elements
  defp advance_to_middle([upper_middle | _remaining_slow], [], lower_middle), do: (lower_middle + upper_middle) / 2.0
end
