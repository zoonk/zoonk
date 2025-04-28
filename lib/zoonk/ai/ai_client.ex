defmodule Zoonk.AI.AIClient do
  @moduledoc """
  Public client for generating AI content
  across various services.

  This module provides a unified interface for
  interacting with different AI services.

  It delegates requests to the appropriate service
  based on the model specified.
  """
  alias Zoonk.AI
  alias Zoonk.AI.AIClient.GeminiClient
  alias Zoonk.AI.AIClient.OpenAIClient
  alias Zoonk.AI.AIClient.TogetherAIClient

  @doc """
  Generates structured output from an AI service based on the given payload.

  Takes an `%AI{}` struct containing the model, messages, and schema configuration.
  Delegates to the appropriate client based on the model specified.

  ## Examples

      iex> payload = %AI{model: "gpt-4", schema: schema, messages: messages}
      iex> AIClient.generate_object(payload)
      {:ok, %{field: "value"}}

      iex> AIClient.generate_object(%AI{model: "unsupported"})
      {:error, "Unsupported model"}
  """
  def generate_object(%AI{model: "gpt-" <> _gpt} = payload) do
    OpenAIClient.generate_object(payload)
  end

  def generate_object(%AI{model: "o" <> _gpt} = payload) do
    OpenAIClient.generate_object(payload)
  end

  def generate_object(%AI{model: "gemini" <> _gpt} = payload) do
    GeminiClient.generate_object(payload)
  end

  def generate_object(%AI{model: "meta-llama" <> _gpt} = payload) do
    TogetherAIClient.generate_object(payload)
  end

  def generate_object(%AI{model: "deepseek-ai" <> _gpt} = payload) do
    TogetherAIClient.generate_object(payload)
  end

  def generate_object(%AI{model: "Qwen" <> _gpt} = payload) do
    TogetherAIClient.generate_object(payload)
  end

  def generate_object(%AI{model: "mistralai" <> _gpt} = payload) do
    TogetherAIClient.generate_object(payload)
  end

  def generate_object(_payload) do
    {:error, "Unsupported model"}
  end
end
