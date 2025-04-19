defmodule Zoonk.AI.AISchemaTest do
  use Zoonk.DataCase, async: true

  alias Zoonk.AI.AISchema

  describe "add_field/2" do
    test "adds fields to the schema" do
      ai_schema =
        %AISchema{}
        |> AISchema.add_field(%{name: "string", age: "integer"})
        |> AISchema.add_field(%{public: "boolean"})

      assert ai_schema.type == "json_schema"
      assert ai_schema.name == ""
      assert ai_schema.strict == true

      assert ai_schema.schema.type == "object"
      assert ai_schema.schema.required == ["age", "name", "public"]
      assert ai_schema.schema.additionalProperties == false

      assert ai_schema.schema.properties.name.type == "string"
      assert ai_schema.schema.properties.age.type == "integer"
      assert ai_schema.schema.properties.public.type == "boolean"
    end
  end
end
