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
      %AI{} = ai = AI.set_model(%AI{}, model)
      assert ai.model == model
    end
  end

  describe "set_schema/2" do
    test "sets the schema" do
      schema =
        %AISchema{name: "user"}
        |> AISchema.add_field(%{name: "string"})
        |> AISchema.add_field(%{age: "integer"})

      %AI{} = ai = AI.set_schema(%AI{}, schema)
      assert ai.text.format == schema
    end

    test "schema must have a valid name" do
      assert_raise ArgumentError, fn -> AI.set_schema(%AI{}, %AISchema{}) end
    end
  end

  describe "add_instructions/2" do
    test "adds instructions to the AI" do
      instructions = "Please summarize the text."
      %AI{} = ai = AI.add_instructions(%AI{}, instructions)
      assert ai.instructions == instructions
    end
  end

  describe "add_message/2" do
    test "adds a message to the AI's context" do
      message = "What's the weather?"
      %AI{} = ai = AI.add_message(%AI{}, message)
      assert length(ai.input) == 1
      assert hd(ai.input) == %{role: "user", content: message}
    end

    test "adds multiple messages to the AI's context" do
      message1 = "What's the weather?"
      message2 = "Tell me a joke."

      ai =
        %AI{}
        |> AI.add_message(message1)
        |> AI.add_message(message2)

      assert hd(ai.input) == %{role: "user", content: message1}
      assert hd(tl(ai.input)) == %{role: "user", content: message2}
      assert length(ai.input) == 2
    end
  end
end
