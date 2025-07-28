defmodule Zoonk.AI.AIClient.TogetherAIClientTest do
  use Zoonk.DataCase, async: true

  import Zoonk.AIFixtures

  alias Zoonk.AI.AIClient.TogetherAIClient
  alias Zoonk.AI.AIPayload

  describe "generate_object/1" do
    test "returns the object when successful" do
      togetherai_stub(%{language: "English"})
      assert {:ok, response} = TogetherAIClient.generate_object(%AIPayload{})
      assert response.language == "English"
      assert response.usage == token_usage()
    end

    test "returns an error when the API call fails" do
      togetherai_stub(%{}, error: "API error")
      assert {:error, "API error"} = TogetherAIClient.generate_object(%AIPayload{})
    end
  end
end
