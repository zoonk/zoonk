defmodule Zoonk.AI.AIClient.OpenRouterClientTest do
  use Zoonk.DataCase, async: true

  import Zoonk.AIFixtures

  alias Zoonk.AI.AIClient.OpenRouterClient
  alias Zoonk.AI.AIPayload

  describe "generate_object/1" do
    test "returns the object when successful" do
      openrouter_stub(%{language: "English"})
      assert {:ok, %{language: "English"}} = OpenRouterClient.generate_object(%AIPayload{})
    end

    test "returns an error when the API call fails" do
      openrouter_stub(%{}, error: "API error")
      assert {:error, "API error"} = OpenRouterClient.generate_object(%AIPayload{})
    end
  end
end
