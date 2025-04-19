defmodule Zoonk.AI.AISchemaTest do
  use Zoonk.DataCase, async: true

  alias Zoonk.AI.AISchema

  describe "add_field/2" do
    test "adds fields to the schema" do
      schema = %AISchema{}
      updated_schema = AISchema.add_field(schema, %{name: "string", age: "integer"})

      assert updated_schema.schema.properties.name.type == "string"
      assert updated_schema.schema.properties.age.type == "integer"
      assert updated_schema.schema.required == ["name", "age"]
      assert updated_schema.schema.additionalProperties == false
    end
  end
end
