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
      assert ai_schema.schema.properties.address.required == ["city", "street"]
      assert ai_schema.schema.properties.address.additionalProperties == false

      assert ai_schema.schema.properties.address.properties.street.type == "string"
      assert ai_schema.schema.properties.address.properties.city.type == "string"
    end

    test "supports array fields" do
      ai_schema = AISchema.add_field(%AISchema{}, %{courses: [%{title: "string", description: "string"}]})

      assert ai_schema.type == "json_schema"
      assert ai_schema.name == ""
      assert ai_schema.strict == true

      assert ai_schema.schema.type == "object"
      assert ai_schema.schema.required == ["courses"]
      assert ai_schema.schema.additionalProperties == false

      assert ai_schema.schema.properties.courses.type == "array"
      assert ai_schema.schema.properties.courses.items.type == "object"
      assert ai_schema.schema.properties.courses.items.required == ["description", "title"]
      assert ai_schema.schema.properties.courses.items.additionalProperties == false

      assert ai_schema.schema.properties.courses.items.properties.title.type == "string"
      assert ai_schema.schema.properties.courses.items.properties.description.type == "string"
    end

    test "supports multiple array fields" do
      ai_schema =
        %AISchema{}
        |> AISchema.add_field(%{courses: [%{title: "string", description: "string"}]})
        |> AISchema.add_field(%{projects: [%{name: "string", status: "string"}]})

      assert ai_schema.type == "json_schema"
      assert ai_schema.name == ""
      assert ai_schema.strict == true

      assert ai_schema.schema.type == "object"
      assert ai_schema.schema.required == ["courses", "projects"]
      assert ai_schema.schema.additionalProperties == false

      assert ai_schema.schema.properties.courses.type == "array"
      assert ai_schema.schema.properties.courses.items.type == "object"
      assert ai_schema.schema.properties.courses.items.required == ["description", "title"]
      assert ai_schema.schema.properties.courses.items.additionalProperties == false
      assert ai_schema.schema.properties.courses.items.properties.title.type == "string"
      assert ai_schema.schema.properties.courses.items.properties.description.type == "string"

      assert ai_schema.schema.properties.projects.type == "array"
      assert ai_schema.schema.properties.projects.items.type == "object"
      assert ai_schema.schema.properties.projects.items.required == ["name", "status"]
      assert ai_schema.schema.properties.projects.items.additionalProperties == false
      assert ai_schema.schema.properties.projects.items.properties.name.type == "string"
      assert ai_schema.schema.properties.projects.items.properties.status.type == "string"
    end

    test "supports enum fields" do
      ai_schema = AISchema.add_field(%AISchema{}, %{status: ["active", "inactive", "pending"]})

      assert ai_schema.type == "json_schema"
      assert ai_schema.name == ""
      assert ai_schema.strict == true

      assert ai_schema.schema.type == "object"
      assert ai_schema.schema.required == ["status"]
      assert ai_schema.schema.additionalProperties == false

      assert ai_schema.schema.properties.status.type == "string"
      assert ai_schema.schema.properties.status.enum == ["active", "inactive", "pending"]
    end
  end
end
