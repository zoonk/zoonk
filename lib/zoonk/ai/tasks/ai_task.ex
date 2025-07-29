defmodule Zoonk.AI.Tasks.AITask do
  @moduledoc """
  Behaviour for AI tasks.

  ## Callbacks

  - `system_prompt/0`: Returns the system prompt for the task.
  - `user_prompt/1`: Returns the user prompt for the task.
  - `json_schema/0`: Returns the JSON schema for the task.
  - `generate_object/1`: Sends a request to the AI service using the default model.
  - `generate_object/2`: Sends a request to the AI service using a specified model.
  """

  @doc """
  System prompt for the task.
  """
  @callback system_prompt() :: String.t()

  @doc """
  User prompt for the task.

  The input is a map containing the user's input and language.
  """
  @callback user_prompt(map()) :: String.t()

  @doc """
  Generates an object using the AI service
  based on the provided input.

  It uses the default model for the task.
  If you need to specify a different model,
  you can use the `generate_object/2` function.
  """
  @callback generate_object(map()) :: {:ok, map()} | {:error, term()}

  @doc """
  Generates an object using the AI service
  based on the provided input and model.

  If you need to use the default model,
  you can use the `generate_object/1` function.
  """
  @callback generate_object(map(), String.t()) :: {:ok, map()} | {:error, term()}

  @doc """
  Sets the JSON schema for the task.

  It must use our schema module for composing schemas: `Zoonk.AI.AISchema`
  """
  @callback json_schema() :: map()
end
