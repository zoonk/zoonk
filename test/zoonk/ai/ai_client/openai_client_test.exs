defmodule Zoonk.AI.AIClient.OpenAIClientTest do
  use Zoonk.DataCase, async: true

  alias Zoonk.AI.AIClient.OpenAIClient

  describe "generate_object/1" do
    test "returns the object when successful" do
      mock_response(%{"type" => "output_text", "text" => ~s({"language":"English"})})
      assert {:ok, %{language: "English"}} = OpenAIClient.generate_object(%Zoonk.AI{})
    end

    test "returns an error when the API call fails" do
      mock_response("", "API error")
      assert {:error, "API error"} = OpenAIClient.generate_object(%Zoonk.AI{})
    end

    test "returns an error when the API returns a refusal" do
      mock_response(%{"type" => "refusal", "refusal" => "Refusal message"})
      assert {:error, "Refusal message"} = OpenAIClient.generate_object(%Zoonk.AI{})
    end

    test "returns an error when the API returns an unexpected response" do
      mock_response(%{"type" => "unknown"})
      assert {:error, "Unknown error"} = OpenAIClient.generate_object(%Zoonk.AI{})
    end
  end

  defp mock_response(mock_data, error \\ nil) do
    Req.Test.stub(:openai_client, fn conn ->
      Req.Test.json(conn, %{
        "error" => error,
        "output" => [
          %{
            "content" => [
              mock_data
            ]
          }
        ]
      })
    end)
  end
end
