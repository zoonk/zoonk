defmodule Zoonk.AI.AIClient.TogetherAIClient do
  @moduledoc """
  TogetherAI service implementation for generating AI responses.

  This module handles communication with the TogetherAI API,
  supporting structured outputs with JSON schema.
  """
  alias Zoonk.AI.AIClient.BaseClient
  alias Zoonk.AI.AIPayload

  @base_url "https://api.together.xyz/v1"
  @responses_endpoint @base_url <> "/chat/completions"

  @doc """
  Generate an object.

  Creates a structured object using the TogetherAI API.

  ## Examples

      iex> TogetherAIClient.generate_object(%AIPayload{})
      {:ok, %Req.Response{}}
  """
  def generate_object(%AIPayload{} = payload) do
    BaseClient.chat_completion(@responses_endpoint, payload, :togetherai, &convert_payload/1)
  end

  defp convert_payload(%AIPayload{} = payload) do
    messages = BaseClient.build_messages(payload)

    %{
      model: payload.model,
      messages: messages,
      response_format: payload.text.format
    }
  end
end
