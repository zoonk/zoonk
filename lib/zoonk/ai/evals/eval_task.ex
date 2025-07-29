defmodule Zoonk.AI.Evals.EvalTask do
  @moduledoc """
  Behaviour for AI evaluation tasks.

  ## Callbacks

  - `model_cases/0`: Returns a list of test cases for evaluating models.
  - `prompt_cases/0`: Returns a list of test cases for evaluating prompts.
  - `generate_object/2`: Sends a request to the AI service to generate an object
  """

  @doc """
  Test cases for evaluating models.

  Create a list of 3-5 test cases that can be used to
  evaluate a prompt across different models.
  """
  @callback model_cases() :: [map()]

  @doc """
  Test cases for evaluating prompts.

  Create an extensive list of test cases that can be used to
  evaluate a prompt in different languages and contexts.

  We run this when we make a prompt change to check for
  regressions in the prompt's performance.
  """
  @callback prompt_cases() :: [map()]

  @doc """
  Send a request to the AI service to generate an object.

  This function should return a map with the generated object
  or an error tuple if the generation fails.
  """
  @callback generate_object(String.t(), map()) :: {:ok, map()} | {:error, term()}
end
