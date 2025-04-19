defmodule Zoonk.AITest do
  use Zoonk.DataCase, async: true

  alias Zoonk.AI
  alias Zoonk.AI.AISchema

  describe "set_model/2" do
    test "uses default model if none provided" do
      Application.put_env(:zoonk, :ai, default_model: "gpt-4.1-mini")
      assert %AI{}.model == "gpt-4.1-mini"
    end

    test "sets the AI model" do
      model = "gpt-4.1"
      ai = AI.set_model(%AI{}, model)
      assert ai.model == model
    end
  end

  describe "set_schema/2" do
    test "sets the schema" do
      schema =
        %AISchema{}
        |> AISchema.add_field(%{name: "string"})
        |> AISchema.add_field(%{age: "integer"})

      ai = AI.set_schema(%AI{}, schema)
      assert ai.text.format == schema
    end
  end

  describe "add_instructions/2" do
    test "adds instructions to the AI" do
      instructions = "Please summarize the text."
      ai = AI.add_instructions(%AI{}, instructions)
      assert ai.instructions == instructions
    end
  end
end
