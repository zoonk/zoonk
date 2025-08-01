defmodule Zoonk.AI.AIClient.BaseClient do
  @moduledoc """
  Base client functionality for AI service implementations.

  This module provides common functionality for making requests
  to AI services, reducing code duplication across different
  AI client implementations.
  """
  alias Zoonk.AI.AIClient.ClientConfig
  alias Zoonk.AI.AIPayload

  @doc """
  Makes a chat completion request to an AI service.

  Takes an endpoint URL, payload, and configuration key,
  then makes the request and handles the response.

  ## Examples

      iex> BaseClient.chat_completion("https://api.service.com/chat", payload, :service)
      {:ok, %{field: "value"}}
  """
  def chat_completion(endpoint, payload, config_key) do
    opts = ClientConfig.req_opts(payload, config_key)

    case Req.post(endpoint, opts) do
      {:ok, %Req.Response{body: %{"error" => error}}} ->
        {:error, error["message"]}

      {:ok, %Req.Response{body: body}} ->
        {:ok, response_content(body)}

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
  def build_messages(%AIPayload{} = payload) do
    instructions = payload.instructions
    messages = payload.input
    [%{role: "system", content: instructions} | messages]
  end

  defp response_content(%{"choices" => choices} = body) do
    choices
    |> hd()
    |> get_in(["message", "content"])
    |> Jason.decode!(keys: :atoms!)
    |> Map.put(:usage, token_usage(body))
  end

  defp token_usage(%{"usage" => usage}) do
    %{
      input: usage["prompt_tokens"],
      output: usage["completion_tokens"],
      total: usage["total_tokens"]
    }
  end
end
