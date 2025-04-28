defmodule Zoonk.AI.AIClient.TogetherAIClient do
  @moduledoc """
  TogetherAI service implementation for generating AI responses.

  This module handles communication with the TogetherAI API using
  the `Responses` endpoint, supporting structured outputs
  with JSON schema.
  """
  alias Zoonk.AI

  @base_url "https://api.together.xyz/v1"
  @responses_endpoint @base_url <> "/chat/completions"

  @doc """
  Generate an object.

  Creates a structured object using the TogetherAI API.

  ## Examples

      iex> TogetherAIClient.generate_object(%Zoonk.AI{})
      {:ok, %Req.Response{}}
  """
  def generate_object(%AI{} = payload) do
    req_opts = [
      json: convert_payload(payload),
      receive_timeout: 300_000,
      connect_options: [timeout: 300_000],
      retry: :transient
    ]

    opts = Keyword.merge(req_opts, Application.get_env(:zoonk, :ai)[:togetherai] || [])

    case Req.post(@responses_endpoint, opts) do
      {:ok, %Req.Response{body: %{"error" => error}}} ->
        {:error, error["message"]}

      {:ok, %Req.Response{body: body}} ->
        choices = hd(body["choices"])
        content = choices["message"]["content"]

        {:ok, Jason.decode!(content, keys: :atoms!)}

      {:error, error} ->
        {:error, error}
    end
  end

  defp convert_payload(%AI{} = payload) do
    messages = get_messages(payload)

    %{
      model: payload.model,
      messages: messages,
      response_format: payload.text.format
    }
  end

  defp get_messages(%AI{} = payload) do
    instructions = payload.instructions
    messages = payload.input
    [%{role: "system", content: instructions} | messages]
  end
end
