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

    test "removes open- prefix from model name" do
      openrouter_stub(%{language: "English"})
      payload = %AIPayload{model: "open/openai/gpt-4o"}
      assert {:ok, %{language: "English"}} = OpenRouterClient.generate_object(payload)
    end

    test "handles models without open- prefix" do
      openrouter_stub(%{language: "English"})
      payload = %AIPayload{model: "openai/gpt-4o"}
      assert {:ok, %{language: "English"}} = OpenRouterClient.generate_object(payload)
    end
  end
end
