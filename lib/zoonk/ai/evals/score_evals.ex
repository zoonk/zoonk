defmodule Zoonk.AI.Evals.ScoreEvals do
  @moduledoc false
  alias Zoonk.AI.Evals.EvalFiles

  @spec calculate_score(atom() | String.t()) :: :ok
  def calculate_score(prompt_name) do
    prompt_name
    |> EvalFiles.load_prompt_scores()
    |> calculate_scores()
    |> EvalFiles.update_scores_markdown(prompt_name)
  end

  @spec update_leaderboard(atom() | String.t(), String.t()) :: :ok
  def update_leaderboard(prompt_name, model) do
    scores =
      prompt_name
      |> EvalFiles.load_model_scores(model)
      |> calculate_scores()

    cost =
      prompt_name
      |> EvalFiles.load_model_outputs(model)
      |> calculate_cost()

    model_data = Map.put(scores, :cost, cost)

    model_data
    |> EvalFiles.update_leaderboard_json(prompt_name, model)
    |> EvalFiles.update_leaderboard_markdown(prompt_name)
  end

  defp calculate_scores(files) when is_list(files) do
    files
    |> extract_scores()
    |> summarize_scores()
  end

  defp calculate_cost(files) when is_list(files) do
    files
    |> extract_costs()
    |> average_cost()
  end

  defp extract_scores(files) do
    for %{"steps" => steps} <- files,
        %{"score" => score} when is_number(score) <- steps,
        do: score
  end

  defp extract_costs(files) do
    for %{"cost_per_100_tasks" => cost} <- files, do: cost
  end

  defp summarize_scores([]), do: %{average: 0.0, median: 0.0}

  defp summarize_scores(scores) do
    %{average: average(scores), median: median(scores)}
  end

  defp average_cost([]), do: 0.0

  defp average_cost(costs) do
    total_input =
      Enum.reduce(costs, 0.0, fn cost, acc ->
        input = Map.get(cost, "input", 0) || 0
        acc + input
      end)

    total_output =
      Enum.reduce(costs, 0.0, fn cost, acc ->
        output = Map.get(cost, "output", 0) || 0
        acc + output
      end)

    total_cost = total_input + total_output

    if total_cost > 0 and length(costs) > 0 do
      Float.round(total_cost / length(costs), 4)
    else
      0.0
    end
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
