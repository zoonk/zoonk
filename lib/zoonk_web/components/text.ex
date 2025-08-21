defmodule ZoonkWeb.Components.Text do
  @moduledoc """
  Provides the UI for rendering text.
  """
  use Phoenix.Component

  attr :tag, :string, default: "p", doc: "HTML tag to use for the text element"

  attr :size, :atom,
    values: [:xxl, :xl, :lg, :md, :sm, :xs],
    default: :md,
    doc: "Size of the text"

  attr :weight, :atom,
    values: [:bold, :semibold, :medium, :normal, nil],
    default: nil,
    doc: "Font weight of the text"

  attr :variant, :atom,
    values: [:primary, :secondary, :muted, :destructive, :custom],
    default: :primary,
    doc: "Color variant of the text"

  attr :for, :string, default: nil, doc: "The for attribute for labels"
  attr :class, :any, default: nil, doc: "CSS class to apply to the text element"
  attr :id, :string, default: nil, doc: "ID of the text element"
  attr :rest, :global, doc: "HTML attributes to apply to the text element"
  slot :inner_block, required: true, doc: "Content to render inside the text element"

  @doc """
  Renders a text element.

  ## Examples

      <.text>Some text</.text>
      <.text tag="h1">Some text</.text>
      <.text size={:xl}>Some text</.text>
      <.text variant={:secondary}>Some text</.text>
  """
  def text(%{tag: "label"} = assigns) do
    ~H"""
    <label
      id={@id}
      for={@for}
      class={[size_class(@size), variant_class(@variant), weight_class(@weight, @size), @class]}
      {@rest}
    >
      {render_slot(@inner_block)}
    </label>
    """
  end

  def text(assigns) do
    ~H"""
    <.dynamic_tag
      tag_name={@tag}
      id={@id}
      class={[size_class(@size), variant_class(@variant), weight_class(@weight, @size), @class]}
      {@rest}
    >
      {render_slot(@inner_block)}
    </.dynamic_tag>
    """
  end

  defp size_class(:xxl), do: "text-2xl font-semibold"
  defp size_class(:xl), do: "text-xl font-medium"
  defp size_class(:lg), do: "text-lg"
  defp size_class(:md), do: "text-base"
  defp size_class(:sm), do: "text-sm"
  defp size_class(:xs), do: "text-xs"

  defp variant_class(:primary), do: "text-zk-foreground"
  defp variant_class(:secondary), do: "text-zk-muted-foreground"
  defp variant_class(:muted), do: "text-zk-muted-foreground"
  defp variant_class(:destructive), do: "text-zk-destructive"
  defp variant_class(:custom), do: nil

  defp weight_class(:bold, _size), do: "font-bold"
  defp weight_class(:semibold, _size), do: "font-semibold"
  defp weight_class(:medium, _size), do: "font-medium"
  defp weight_class(:normal, _size), do: "font-normal"
  defp weight_class(nil, :xxl), do: "font-semibold"
  defp weight_class(nil, :xl), do: "font-medium"
  defp weight_class(nil, _size), do: "font-normal"
end
