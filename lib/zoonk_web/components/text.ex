defmodule ZoonkWeb.Components.Text do
  @moduledoc """
  Provides the UI for rendering text.
  """
  use Phoenix.Component

  attr :element, :atom, values: [:h1, :h2, :h3, :h4, :h5, :h6, :p, :span, :label], default: :p
  attr :size, :atom, values: [:header, :title, :subtitle, :body, :caption], default: :body
  attr :variant, :atom, values: [:primary, :secondary], default: :primary
  attr :class, :any, default: nil
  attr :id, :string, default: nil
  attr :for, :string, default: nil
  attr :rest, :global
  slot :inner_block, required: true

  @doc """
  Renders a text element.

  ## Examples

      <.text>Some text</.text>
      <.text element={:h1}>Some text</.text>
      <.text size={:title}>Some text</.text>
      <.text variant={:secondary}>Some text</.text>
  """
  def text(%{element: :h1} = assigns) do
    ~H"""
    <h1 id={@id} class={[get_size_class(@size), get_variant_class(@variant), @class]} {@rest}>
      {render_slot(@inner_block)}
    </h1>
    """
  end

  def text(%{element: :h2} = assigns) do
    ~H"""
    <h2 id={@id} class={[get_size_class(@size), get_variant_class(@variant), @class]} {@rest}>
      {render_slot(@inner_block)}
    </h2>
    """
  end

  def text(%{element: :h3} = assigns) do
    ~H"""
    <h3 id={@id} class={[get_size_class(@size), get_variant_class(@variant), @class]} {@rest}>
      {render_slot(@inner_block)}
    </h3>
    """
  end

  def text(%{element: :h4} = assigns) do
    ~H"""
    <h4 id={@id} class={[get_size_class(@size), get_variant_class(@variant), @class]} {@rest}>
      {render_slot(@inner_block)}
    </h4>
    """
  end

  def text(%{element: :h5} = assigns) do
    ~H"""
    <h5 id={@id} class={[get_size_class(@size), get_variant_class(@variant), @class]} {@rest}>
      {render_slot(@inner_block)}
    </h5>
    """
  end

  def text(%{element: :h6} = assigns) do
    ~H"""
    <h6 id={@id} class={[get_size_class(@size), get_variant_class(@variant), @class]} {@rest}>
      {render_slot(@inner_block)}
    </h6>
    """
  end

  def text(%{element: :p} = assigns) do
    ~H"""
    <p id={@id} class={[get_size_class(@size), get_variant_class(@variant), @class]} {@rest}>
      {render_slot(@inner_block)}
    </p>
    """
  end

  def text(%{element: :span} = assigns) do
    ~H"""
    <span id={@id} class={[get_size_class(@size), get_variant_class(@variant), @class]} {@rest}>
      {render_slot(@inner_block)}
    </span>
    """
  end

  def text(%{element: :label} = assigns) do
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
