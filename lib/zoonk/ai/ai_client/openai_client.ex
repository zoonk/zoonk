defmodule Zoonk.AI.AIClient.OpenAIClient do
  @moduledoc """
  OpenAI service implementation for generating AI responses.

  This module handles communication with the OpenAI API using
  the `Responses` endpoint, supporting structured outputs
  with JSON schema.
  """
  alias Zoonk.AI.AIClient.ClientConfig
  alias Zoonk.AI.AIPayload

  @base_url "https://api.openai.com/v1"
  @responses_endpoint @base_url <> "/responses"

  @doc """
  Generate an object.

  Creates a structured object using the OpenAI API.

  ## Examples

      iex> OpenAIClient.generate_object(%AIPayload{})
      {:ok, %Req.Response{}}
  """
  def generate_object(%AIPayload{} = payload) do
    opts = ClientConfig.req_opts(payload, :openai)

    case Req.post(@responses_endpoint, opts) do
      {:ok, %Req.Response{body: %{"error" => nil} = body}} ->
        response_content(body)

      {:ok, %Req.Response{body: %{"error" => error}}} ->
        {:error, error}

      {:error, error} ->
        {:error, error}
    end
  end

  defp response_content(%{"output" => output} = body) do
    message = Enum.find(output, &(&1["type"] == "message"))
    response_content(message["content"], body)
  end

  defp response_content([%{"type" => "output_text"} = content], body) do
    {:ok,
     content["text"]
     |> Jason.decode!(keys: :atoms!)
     |> Map.put(:usage, token_usage(body))}
  end

  defp response_content([%{"type" => "refusal"} = content], _body) do
    {:error, content["refusal"]}
  end

  defp response_content(_content, _body) do
    {:error, "Unknown error"}
  end

  defp token_usage(%{"usage" => usage}) do
    %{
      input: usage["input_tokens"],
      output: usage["output_tokens"],
      total: usage["total_tokens"]
    }
  end
end
