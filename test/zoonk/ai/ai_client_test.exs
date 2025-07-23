defmodule Zoonk.AI.AIClientTest do
  use Zoonk.DataCase, async: true

  import Zoonk.AIFixtures

  alias Zoonk.AI
  alias Zoonk.AI.AIClient

  describe "generate_object/1" do
    test "delegates to OpenAIClient for gpt models" do
      openai_stub(%{language: "en"})

      payload = %AI{model: "gpt-4.1-mini"}
      assert {:ok, %{}} = AIClient.generate_object(payload)
    end

    test "delegates to OpenAIClient for reasoning models" do
      openai_stub(%{language: "en"})

      payload = %AI{model: "o3"}
      assert {:ok, %{}} = AIClient.generate_object(payload)
    end

    test "delegates to GeminiClient for Gemini models" do
      gemini_stub(%{language: "en"})

      payload = %AI{model: "gemini-1.5"}
      assert {:ok, %{}} = AIClient.generate_object(payload)
    end

    test "delegates to TogetherAIClient for meta-llama models" do
      togetherai_stub(%{language: "en"})

      payload = %AI{model: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8"}
      assert {:ok, %{}} = AIClient.generate_object(payload)
    end

    test "delegates to TogetherAIClient for deepseek-ai models" do
      togetherai_stub(%{language: "en"})

      payload = %AI{model: "deepseek-ai/DeepSeek-7B"}
      assert {:ok, %{}} = AIClient.generate_object(payload)
    end

    test "delegates to TogetherAIClient for Qwen models" do
      togetherai_stub(%{language: "en"})

      payload = %AI{model: "Qwen/Qwen2.5-7B-Instruct-Turbo"}
      assert {:ok, %{}} = AIClient.generate_object(payload)
    end

    test "delegates to TogetherAIClient for mistralai models" do
      togetherai_stub(%{language: "en"})

      payload = %AI{model: "mistralai/Mistral-7B"}
      assert {:ok, %{}} = AIClient.generate_object(payload)
    end

    test "delegates to OpenRouterClient for open/ prefixed models" do
      openrouter_stub(%{provider: "openrouter", model: "gpt-4o"})

      payload = %AI{model: "open/openai/gpt-4o"}
      assert {:ok, %{provider: "openrouter", model: "gpt-4o"}} = AIClient.generate_object(payload)
    end
  end

  test "returns an error for unsupported models" do
    payload = %AI{model: "unsupported-model"}
    assert {:error, "Unsupported model"} = AIClient.generate_object(payload)
  end
end
