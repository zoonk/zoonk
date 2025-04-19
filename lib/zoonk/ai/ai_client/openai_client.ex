defmodule Zoonk.AI.AIClient.OpenAIClient do
  @moduledoc """
  OpenAI service implementation for generating AI responses.

  This module handles communication with the OpenAI API using
  the `Responses` endpoint, supporting structured outputs
  with JSON schema.
  """
  alias Zoonk.AI

  @base_url "https://api.openai.com/v1"
  @responses_endpoint @base_url <> "/responses"

  @doc """
  Generate an object.

  Creates a structured object using the OpenAI API.

  ## Examples

      iex> OpenAIClient.generate_object(%Zoonk.AI{})
      {:ok, %Req.Response{}}
  """
  def generate_object(%AI{} = payload) do
    Req.post(@responses_endpoint, json: payload, auth: {:bearer, get_api_key()})
  end

  defp get_api_key do
    Application.get_env(:zoonk, :ai)[:openai][:api_key]
  end
end
