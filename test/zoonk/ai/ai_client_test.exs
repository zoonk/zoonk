defmodule Zoonk.AI.AIClientTest do
  use Zoonk.DataCase, async: true

  import Zoonk.AIFixtures

  alias Zoonk.AI.AIClient
  alias Zoonk.AI.AIPayload

  describe "generate_object/1" do
    test "delegates to OpenAIClient for gpt models" do
      openai_stub(%{language: "en"})

      payload = %AIPayload{model: "gpt-4.1-mini"}
      assert {:ok, %{} = response} = AIClient.generate_object(payload)
      assert_usage(response)
    end

    test "delegates to OpenAIClient for reasoning models" do
      openai_stub(%{language: "en"})

      models = ["o3", "o3-mini", "o4-mini"]

      Enum.each(models, fn model ->
        payload = %AIPayload{model: model}
        assert {:ok, %{} = response} = AIClient.generate_object(payload)
        assert_usage(response)
      end)
    end

    test "delegates to GeminiClient for Gemini models" do
      gemini_stub(%{language: "en"})

      payload = %AIPayload{model: "gemini-1.5"}
      assert {:ok, %{} = response} = AIClient.generate_object(payload)
      assert_usage(response)
    end

    test "delegates to OpenRouterClient for meta-llama models" do
      openrouter_stub(%{language: "en"})

      payload = %AIPayload{model: "meta-llama/llama-4-maverick"}
      assert {:ok, %{} = response} = AIClient.generate_object(payload)
      assert_usage(response)
    end

    test "delegates to OpenRouterClient for anthropic models" do
      openrouter_stub(%{language: "en"})

      payload = %AIPayload{model: "anthropic/claude-sonnet-4"}
      assert {:ok, %{}} = AIClient.generate_object(payload)
    end

    test "delegates to OpenRouterClient for deepseek models" do
      openrouter_stub(%{language: "en"})

      payload = %AIPayload{model: "deepseek/deepseek-r1"}
      assert {:ok, %{}} = AIClient.generate_object(payload)
    end

    test "delegates to OpenRouterClient for Qwen models" do
      openrouter_stub(%{language: "en"})

      payload = %AIPayload{model: "qwen/qwen3-235b-a22b-07-25"}
      assert {:ok, %{}} = AIClient.generate_object(payload)
    end

    test "delegates to OpenRouterClient for mistralai models" do
      openrouter_stub(%{language: "en"})

      payload = %AIPayload{model: "mistralai/mistral-medium-3"}
      assert {:ok, %{}} = AIClient.generate_object(payload)
    end

    test "delegates to TogetherAIClient for together/ prefixed models" do
      togetherai_stub(%{language: "en"})

      payload = %AIPayload{model: "together/meta-llama/llama-4-maverick"}
      assert {:ok, %{} = response} = AIClient.generate_object(payload)
      assert_usage(response)
    end
  end

  defp assert_usage(response) do
    assert %{usage: usage} = response
    assert %{input: 50, output: 50, total: 100} = usage
  end
end
