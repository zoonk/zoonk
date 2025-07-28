defmodule Zoonk.AI.AIClient.GeminiClient do
  @moduledoc """
  Gemini service implementation for generating AI responses.

  This module handles communication with the Gemini API,
  supporting structured outputs with JSON schema.
  """
  alias Zoonk.AI.AIClient.ClientConfig
  alias Zoonk.AI.AIPayload
  alias Zoonk.AI.AISchema

  @base_url "https://generativelanguage.googleapis.com/v1beta/models"

  @doc """
  Generate an object.

  Creates a structured object using the Gemini API.

  ## Examples

      iex> GeminiClient.generate_object(%AIPayload{})
      {:ok, %Req.Response{}}
  """
  def generate_object(%AIPayload{} = payload) do
    endpoint = get_endpoint(payload.model)

    case Req.post(endpoint, get_opts(payload)) do
      {:ok, %Req.Response{body: %{"error" => error}}} ->
        {:error, error["message"]}

      {:ok, %Req.Response{body: body}} ->
        candidates = hd(body["candidates"])
        parts = candidates["content"]["parts"]
        content = hd(parts)["text"]

        {:ok, Jason.decode!(content, keys: :atoms!)}

      {:error, error} ->
        {:error, error}
    end
  end

  defp convert_payload(%AIPayload{} = payload) do
    %{
      systemInstruction: system_instructions(payload),
      contents: [%{parts: get_messages(payload.input)}],
      generationConfig: %{
        response_mime_type: "application/json",
        response_schema: get_schema(payload.text.format)
      }
    }
  end

  defp system_instructions(%AIPayload{} = payload) do
    %{
      parts: [%{text: payload.instructions}]
    }
  end

  defp get_messages(input) do
    Enum.map(input, fn input -> %{text: input.content} end)
  end

  defp get_schema(%AISchema{} = ai_schema) do
    remove_additional_properties(ai_schema.schema)
  end

  defp remove_additional_properties(%{} = m) do
    m
    |> Map.drop([:additionalProperties, "additionalProperties"])
    |> Map.new(fn {k, v} -> {k, remove_additional_properties(v)} end)
  end

  defp remove_additional_properties(list) when is_list(list), do: Enum.map(list, &remove_additional_properties/1)

  defp remove_additional_properties(other), do: other

  defp get_opts(payload) do
    payload
    |> convert_payload()
    |> ClientConfig.req_opts(:gemini)
    |> Keyword.delete(:api_key)
  end

  defp get_endpoint(model) do
    "#{@base_url}/#{model}:generateContent?key=#{get_api_key()}"
  end

  defp get_api_key do
    Application.get_env(:zoonk, :ai)[:gemini][:api_key]
  end
end
