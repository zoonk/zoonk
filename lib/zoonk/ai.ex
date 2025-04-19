defmodule Zoonk.AI do
  @moduledoc """
  Create AI payloads for external APIs/services.

  This module allows you to build requests for
  AI services using a composable API.

  It supports structured output via JSON Schema
  to ensure consistent responses.
  """
  defstruct model: Application.compile_env(:zoonk, :ai)[:default_model] || "gpt-4.1-mini",
            instructions: "",
            input: [],
            text: %{format: %Zoonk.AI.AISchema{}}

  @doc """
  Set the AI model to use.

  ## Examples

      iex> AI.set_model(%Zoonk.AI{}, "gpt-4.1")
      %AI{model: "gpt-4.1"}
  """
  def set_model(%__MODULE__{} = ai, model) do
    %{ai | model: model}
  end
end
