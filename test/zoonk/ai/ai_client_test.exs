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
  end

  test "returns an error for unsupported models" do
    payload = %AI{model: "unsupported-model"}
    assert {:error, "Unsupported model"} = AIClient.generate_object(payload)
  end
end
