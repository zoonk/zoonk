defmodule Zoonk.AI.AISchema do
  @moduledoc """
  Defines schema specifications for structured AI outputs.

  This module lets you create JSON Schema definitions to ensure
  AI responses follow a specific structure.

  It supports nested schemas and field definitions with various data types.

  ## Examples

      # Creating a basic schema
      %AISchema{}
      |> AISchema.add_field(%{name: "string"})
      |> AISchema.add_field(%{age: "integer"})

      # Creating a list
      address = %AISchema{}
      |> AISchema.add_field(%{courses: "array"})
      |> AISchema.add_field(courses: %{title: "string"})
      |> AISchema.add_field(courses: %{description: "string"})

      # Passing options
      %AISchema{}
      |> AISchema.add_field(%{name: "string"}, optional: true)
  """
  defstruct type: "json_schema",
            name: "",
            strict: true,
            schema: %{type: "object", properties: %{}, required: [], additionalProperties: false}

  @doc """
  Adds fields to the schema.

  ## Examples

      iex> AISchema.add_field(%AISchema{}, %{name: "string"})
      %AISchema{schema: %{properties: %{name: %{type: "string"}}}}

      iex> AISchema.add_field(%AISchema{}, %{age: "integer", name: "string"})
      %AISchema{schema: %{properties: %{age: %{type: "integer"}, name: %{type: "string"}}}}
  """
  def add_field(%__MODULE__{schema: schema} = ai_schema, fields) do
    new_props = Map.new(fields, fn {k, v} -> {k, %{type: v}} end)
    props = Map.merge(schema.properties, new_props)

    new_schema = %{
      schema
      | properties: props,
        required: keys_to_string(props)
    }

    %{ai_schema | schema: new_schema}
  end

  defp keys_to_string(map) do
    map
    |> Map.keys()
    |> Enum.map(&to_string/1)
  end
end
