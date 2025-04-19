defmodule Zoonk.AITest do
  use Zoonk.DataCase, async: true

  describe "set_model/1" do
    test "uses default model if none provided" do
      Application.put_env(:zoonk, :ai, default_model: "gpt-4.1-mini")
      assert %Zoonk.AI{}.model == "gpt-4.1-mini"
    end

    test "sets the AI model" do
      model = "gpt-4.1"
      ai = Zoonk.AI.set_model(%Zoonk.AI{}, model)
      assert ai.model == model
    end
  end
end
