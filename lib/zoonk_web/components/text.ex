defmodule ZoonkWeb.Components.Text do
  @moduledoc """
  Provides the UI for rendering text.
  """
  use Phoenix.Component

  attr :tag, :string, default: "p", doc: "HTML tag to use for the text element"
  attr :size, :atom, values: [:header, :title, :subtitle, :body, :caption], default: :body, doc: "Size of the text"
  attr :variant, :atom, values: [:primary, :secondary], default: :primary, doc: "Color variant of the text"
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
      <.text size={:title}>Some text</.text>
      <.text variant={:secondary}>Some text</.text>
  """
  def text(%{tag: "label"} = assigns) do
    ~H"""
    <label
      id={@id}
      for={@for}
      class={[get_size_class(@size), get_variant_class(@variant), @class]}
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
      class={[get_size_class(@size), get_variant_class(@variant), @class]}
      {@rest}
    >
      {render_slot(@inner_block)}
    </.dynamic_tag>
    """
  end

  defp get_size_class(:header), do: "text-2xl font-semibold"
  defp get_size_class(:title), do: "text-xl font-medium"
  defp get_size_class(:subtitle), do: "text-lg"
  defp get_size_class(:body), do: "text-base"
  defp get_size_class(:caption), do: "text-sm"

  defp get_variant_class(:primary),
    do: ["text-zk-text-primary", "dark:text-zk-text-inverse", "contrast-more:text-zk-text-contrast"]

  defp get_variant_class(:secondary),
    do: [
      "text-zk-text-secondary",
      "dark:text-zk-text-inverse-secondary",
      "contrast-more:text-zk-text-primary",
      "dark:contrast-more:text-zk-text-inverse"
    ]
end
