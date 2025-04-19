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

    test "supports nested objects" do
      ai_schema = AISchema.add_field(%AISchema{}, %{address: %{street: "string", city: "string"}})

      assert ai_schema.type == "json_schema"
      assert ai_schema.name == ""
      assert ai_schema.strict == true

      assert ai_schema.schema.type == "object"
      assert ai_schema.schema.required == ["address"]
      assert ai_schema.schema.additionalProperties == false

      assert ai_schema.schema.properties.address.type == "object"
      assert ai_schema.schema.properties.address.required == ["street", "city"]
      assert ai_schema.schema.properties.address.additionalProperties == false

      assert ai_schema.schema.properties.address.properties.street.type == "string"
      assert ai_schema.schema.properties.address.properties.city.type == "string"
    end
  end
end
