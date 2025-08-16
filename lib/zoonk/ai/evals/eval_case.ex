defmodule Zoonk.AI.Evals.EvalCase do
  @moduledoc """
  Behaviour for AI evaluation cases.

  ## Callbacks

  - `model/0`: Returns a list of test cases for evaluating models.
  - `prompt/0`: Returns a list of test cases for evaluating prompts.
  """

  @doc """
  Test cases for evaluating models.

  Create a list of 20-50 test cases that can be used to
  evaluate a prompt across different models.
  """
  @callback cases() :: [map()]
end
