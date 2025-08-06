defmodule Zoonk.AI.Evals.EvalCase do
  @moduledoc """
  Behaviour for AI evaluation cases.

  ## Callbacks

  - `model/0`: Returns a list of test cases for evaluating models.
  - `prompt/0`: Returns a list of test cases for evaluating prompts.
  """

  @doc """
  Test cases for evaluating models.

  Create a list of 3-5 test cases that can be used to
  evaluate a prompt across different models.
  """
  @callback model() :: [map()]

  @doc """
  Test cases for evaluating prompts.

  Create an extensive list of test cases that can be used to
  evaluate a prompt in different languages and contexts.

  We run this when we make a prompt change to check for
  regressions in the prompt's performance.
  """
  @callback prompt() :: [map()]
end
