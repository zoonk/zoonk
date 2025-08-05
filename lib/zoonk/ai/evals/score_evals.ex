defmodule Zoonk.AI.Evals.ScoreEvals do
  @moduledoc false
  alias Zoonk.AI.Evals.EvalFiles

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
