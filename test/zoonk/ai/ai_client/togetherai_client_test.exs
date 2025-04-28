defmodule Zoonk.AI.AIClient.TogetherAIClientTest do
  use Zoonk.DataCase, async: true

  import Zoonk.AIFixtures

  alias Zoonk.AI.AIClient.TogetherAIClient

  describe "generate_object/1" do
    test "returns the object when successful" do
      togetherai_stub(%{language: "English"})
      assert {:ok, %{language: "English"}} = TogetherAIClient.generate_object(%Zoonk.AI{})
    end

    test "returns an error when the API call fails" do
      togetherai_stub(%{}, error: "API error")
      assert {:error, "API error"} = TogetherAIClient.generate_object(%Zoonk.AI{})
    end
  end
end
