defmodule Zoonk.AI.AIClient.GeminiClientTest do
  use Zoonk.DataCase, async: true

  import Zoonk.AIFixtures

  alias Zoonk.AI.AIClient.GeminiClient

  describe "generate_object/1" do
    test "returns the object when successful" do
      gemini_stub(%{language: "English"})
      assert {:ok, %{language: "English"}} = GeminiClient.generate_object(%Zoonk.AI{})
    end

    test "returns an error when the API call fails" do
      gemini_stub(%{}, error: "API error")
      assert {:error, "API error"} = GeminiClient.generate_object(%Zoonk.AI{})
    end
  end
end
