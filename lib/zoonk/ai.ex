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

  @doc """
  Set a schema.

  ## Examples

      iex> AI.set_schema(%Zoonk.AI{}, %Zoonk.AI.AISchema{})
      %AI{text: %{format: %Zoonk.AI.AISchema{}}}
  """
  def set_schema(%__MODULE__{} = ai, schema) do
    %{ai | text: %{format: schema}}
  end

  @doc """
  Add instructions to the AI.

  Inserts a system message as the first item in the model's context.

  ## Examples

      iex> AI.add_instructions(%Zoonk.AI{}, "Please summarize the text.")
      %AI{instructions: "Please summarize the text."}
  """
  def add_instructions(%__MODULE__{} = ai, instructions) do
    %{ai | instructions: instructions}
  end

  @doc """
  Add a message to the AI's context.

  This is usually a user message or input.

  ## Examples

      iex> AI.add_message(%Zoonk.AI{}, "What's the weather?")
      %AI{input: [%{role: "user", content: "What's the weather?"}]}
  """
  def add_message(%__MODULE__{} = ai, message) do
    new_message = %{role: "user", content: message}
    %{ai | input: [new_message | ai.input]}
  end
end
