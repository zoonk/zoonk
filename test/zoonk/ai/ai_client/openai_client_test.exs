defmodule Zoonk.AI.AIClient.OpenAIClientTest do
  use Zoonk.DataCase, async: true

  import Zoonk.AIFixtures

  alias Zoonk.AI.AIClient.OpenAIClient
  alias Zoonk.AI.AIPayload

  describe "generate_object/1" do
    test "returns the object when successful" do
      openai_stub(%{language: "English"})
      assert {:ok, response} = OpenAIClient.generate_object(%AIPayload{})
      assert response.language == "English"
      assert response.usage == token_usage()
    end

    test "returns an error when the API call fails" do
      openai_stub(%{}, error: "API error")
      assert {:error, "API error"} = OpenAIClient.generate_object(%AIPayload{})
    end

    test "returns an error when the API returns a refusal" do
      openai_stub(%{}, refusal: "Refusal message")
      assert {:error, "Refusal message"} = OpenAIClient.generate_object(%AIPayload{})
    end
  end
end
