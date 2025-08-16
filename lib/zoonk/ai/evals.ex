defmodule Zoonk.AI.Evals do
  @moduledoc """
  Local evaluation system for AI prompts.

  This module provides functionality to evaluate AI prompts
  across multiple models to detect regressions and test
  new models as they become available.
  """

  alias Zoonk.AI.Evals.EvalModels
  alias Zoonk.AI.Evals.EvalRunner
  alias Zoonk.AI.Evals.ScoreEvals

  @doc """
  Evaluate all models for a specific prompt.

  Iterates over all supported models and evaluates each one for the given prompt.

  ## Examples

      iex> evaluate_models(:suggest_courses)
      :ok
  """
  @spec evaluate_models(atom()) :: :ok
  def evaluate_models(prompt) do
    Enum.each(EvalModels.list_models(), fn model ->
      evaluate_model(prompt, model.name)
    end)
  end

  @doc """
  Evaluate all models from a specific pricing tier.

  ## Examples

      iex> evaluate_models(:suggest_courses, :cheap)
      :ok
  """
  @spec evaluate_models(atom(), EvalModels.tier()) :: :ok
  def evaluate_models(prompt, tier) do
    models = EvalModels.list_models(tier)

    Enum.each(models, fn model ->
      evaluate_model(prompt, model.name)
    end)
  end

  @doc """
  Evaluate a model for a specific prompt.

  It's meant to test model capabilities for a specific prompt.
  This will usually test a small set of test cases (e.g. 3-5).

  ## Examples

      iex> evaluate_model(:suggest_courses, "openai/gpt-4.1")
      :ok
  """
  @spec evaluate_model(atom(), String.t()) :: :ok
  def evaluate_model(prompt, model) do
    EvalRunner.generate_object(prompt, model)
    ScoreEvals.update_leaderboard(prompt, model)
  end

  @doc """
  Updates leaderboard for all models.

  ## Examples

      iex> update_leaderboard(:suggest_courses)
      :ok
  """
  @spec update_leaderboard(atom()) :: :ok
  def update_leaderboard(prompt) do
    Enum.each(EvalModels.list_models(), fn model ->
      ScoreEvals.update_leaderboard(prompt, model.name)
    end)
  end
end
