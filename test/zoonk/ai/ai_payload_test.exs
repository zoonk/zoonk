defmodule Zoonk.AIPayloadTest do
  use Zoonk.DataCase, async: true

  alias Zoonk.AI.AIPayload
  alias Zoonk.AI.AISchema

  describe "set_model/2" do
    test "uses default model if none provided" do
      assert %AIPayload{}.model == "gpt-4.1-nano"
    end

    test "sets the AI model" do
      model = "gpt-4.1"
      %AIPayload{} = ai = AIPayload.set_model(%AIPayload{}, model)
      assert ai.model == model
    end
  end

  describe "set_schema/2" do
    test "sets the schema" do
      schema =
        %AISchema{name: "user"}
        |> AISchema.add_field(%{name: "string"})
        |> AISchema.add_field(%{age: "integer"})

      %AIPayload{} = ai = AIPayload.set_schema(%AIPayload{}, schema)
      assert ai.text.format == schema
    end

    test "schema must have a valid name" do
      assert_raise ArgumentError, fn -> AIPayload.set_schema(%AIPayload{}, %AISchema{}) end
    end
  end

  describe "add_instructions/2" do
    test "adds instructions to the AI" do
      instructions = "Please summarize the text."
      %AIPayload{} = ai = AIPayload.add_instructions(%AIPayload{}, instructions)
      assert ai.instructions == instructions
    end
  end

  describe "add_message/2" do
    test "adds a message to the AI's context" do
      message = "What's the weather?"
      %AIPayload{} = ai = AIPayload.add_message(%AIPayload{}, message)
      assert length(ai.input) == 1
      assert hd(ai.input) == %{role: "user", content: message}
    end

    test "adds multiple messages to the AI's context" do
      message1 = "What's the weather?"
      message2 = "Tell me a joke."

      ai =
        %AIPayload{}
        |> AIPayload.add_message(message1)
        |> AIPayload.add_message(message2)

      assert hd(ai.input) == %{role: "user", content: message1}
      assert hd(tl(ai.input)) == %{role: "user", content: message2}
      assert length(ai.input) == 2
    end
  end
end
