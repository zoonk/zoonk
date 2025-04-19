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
      |> AISchema.add_field(%{courses: [%{title: "string", description: "string"}]})

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

      iex> AISchema.add_field(%AISchema{}, %{courses: [%{title: "string"}]})
      %AISchema{schema: %{properties: %{courses: %{type: "array", items: %{type: "object", properties: %{title: %{type: "string"}}}}}}}

      iex> AISchema.add_field(%AISchema{}, [%{title: "string"}])
      %AISchema{schema: %{type: "array", items: %{type: "object", properties: %{title: %{type: "string"}}}}}
  """
  def add_field(%__MODULE__{} = ai_schema, [%{} = item_schema]) do
    items_props = fields_to_json_props(item_schema)

    %{
      ai_schema
      | schema: %{
          type: "array",
          items: %{
            type: "object",
            properties: items_props,
            required: keys_to_string(items_props),
            additionalProperties: false
          },
          additionalProperties: false
        }
    }
  end

  def add_field(%__MODULE__{schema: schema} = ai_schema, %{} = fields) do
    %{ai_schema | schema: merge_fields(schema, fields)}
  end

  defp merge_fields(schema, fields) do
    new_properties = Map.merge(schema.properties, fields_to_json_props(fields))
    %{schema | properties: new_properties, required: keys_to_string(new_properties)}
  end

  defp fields_to_json_props(%{} = fields) do
    Map.new(fields, &fields_to_json_props/1)
  end

  defp fields_to_json_props({key, %{} = nested}) do
    nested_props = fields_to_json_props(nested)

    {key,
     %{
       type: "object",
       properties: nested_props,
       required: keys_to_string(nested_props),
       additionalProperties: false
     }}
  end

  defp fields_to_json_props({key, [%{} = item_schema]}) do
    items_props = fields_to_json_props(item_schema)

    {key,
     %{
       type: "array",
       items: %{
         type: "object",
         properties: items_props,
         required: keys_to_string(items_props),
         additionalProperties: false
       }
     }}
  end

  defp fields_to_json_props({key, type}) do
    {key, %{type: type}}
  end

  defp keys_to_string(map) do
    map
    |> Map.keys()
    |> Enum.map(&to_string/1)
    |> Enum.sort()
  end
end
