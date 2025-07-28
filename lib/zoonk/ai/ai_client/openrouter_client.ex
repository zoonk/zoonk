defmodule Zoonk.AI.AIClient.OpenRouterClient do
  @moduledoc """
  OpenRouter service implementation for generating AI responses.

  This module handles communication with the OpenRouter API,
  supporting structured outputs with JSON schema.
  OpenRouter provides access to multiple AI providers through
  an OpenAI-compatible chat completions API.
  """
  alias Zoonk.AI.AIClient.BaseClient
  alias Zoonk.AI.AIPayload

  @base_url "https://openrouter.ai/api/v1"
  @chat_endpoint @base_url <> "/chat/completions"

  @doc """
  Generate an object.

  Creates a structured object using the OpenRouter API.
  The model name should have the "open-" prefix removed
  before sending to the API.

  ## Examples

      iex> OpenRouterClient.generate_object(%AIPayload{model: "openai/gpt-4o"})
      {:ok, %{field: "value"}}
  """
  def generate_object(%AIPayload{} = payload) do
    BaseClient.chat_completion(@chat_endpoint, req_payload(payload), :openrouter)
  end

  defp req_payload(%AIPayload{} = payload) do
    messages = BaseClient.build_messages(payload)

    %{
      model: payload.model,
      messages: messages,
      response_format: %{
        type: "json_schema",
        json_schema: %{
          name: payload.text.format.name,
          schema: payload.text.format.schema
        }
      }
    }
  end
end
