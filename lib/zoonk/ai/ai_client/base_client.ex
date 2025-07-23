defmodule Zoonk.AI.AIClient.BaseClient do
  @moduledoc """
  Base client functionality for AI service implementations.

  This module provides common functionality for making requests
  to AI services, reducing code duplication across different
  AI client implementations.
  """
  alias Zoonk.AI

  @doc """
  Makes a chat completion request to an AI service.

  Takes an endpoint URL, payload, and configuration key,
  then makes the request and handles the response.

  ## Examples

      iex> BaseClient.chat_completion("https://api.service.com/chat", payload, :service)
      {:ok, %{field: "value"}}
  """
  def chat_completion(endpoint, %AI{} = payload, config_key, payload_converter) do
    req_opts = [
      json: payload_converter.(payload),
      receive_timeout: 300_000,
      connect_options: [timeout: 300_000],
      retry: :transient
    ]

    opts = Keyword.merge(req_opts, Application.get_env(:zoonk, :ai)[config_key] || [])

    case Req.post(endpoint, opts) do
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

  @doc """
  Builds messages array from AI payload.

  Combines system instructions with user messages.

  ## Examples

      iex> BaseClient.build_messages(%AI{instructions: "You are helpful", input: []})
      [%{role: "system", content: "You are helpful"}]
  """
  def build_messages(%AI{} = payload) do
    instructions = payload.instructions
    messages = payload.input
    [%{role: "system", content: instructions} | messages]
  end
end
