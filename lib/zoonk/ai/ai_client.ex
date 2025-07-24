defmodule Zoonk.AI.AIClient do
  @moduledoc """
  Public client for generating AI content
  across various services.

  This module provides a unified interface for
  interacting with different AI services.

  It delegates requests to the appropriate service
  based on the model specified.
  """
  alias Zoonk.AI.AIClient.GeminiClient
  alias Zoonk.AI.AIClient.OpenAIClient
  alias Zoonk.AI.AIClient.OpenRouterClient
  alias Zoonk.AI.AIClient.TogetherAIClient
  alias Zoonk.AI.AIPayload

  @doc """
  Generates structured output from an AI service based on the given payload.

  Takes a `Zoonk.AI.AIPayload` struct containing the model, messages, and schema configuration.
  Delegates to the appropriate client based on the model specified.

  ## Examples

      iex> payload = %AIPayload{model: "gpt-4", schema: schema, messages: messages}
      iex> AIClient.generate_object(payload)
      {:ok, %{field: "value"}}

      iex> AIClient.generate_object(%AIPayload{model: "unsupported"})
      {:error, "Unsupported model"}
  """

  def generate_object(%AIPayload{model: "gpt-" <> _gpt} = payload) do
    OpenAIClient.generate_object(payload)
  end

  def generate_object(%AIPayload{model: "o3" <> _gpt} = payload) do
    OpenAIClient.generate_object(payload)
  end

  def generate_object(%AIPayload{model: "o4" <> _gpt} = payload) do
    OpenAIClient.generate_object(payload)
  end

  def generate_object(%AIPayload{model: "gemini" <> _gpt} = payload) do
    GeminiClient.generate_object(payload)
  end

  def generate_object(%AIPayload{model: "together/" <> _gpt} = payload) do
    TogetherAIClient.generate_object(payload)
  end

  def generate_object(payload) do
    OpenRouterClient.generate_object(payload)
  end
end
