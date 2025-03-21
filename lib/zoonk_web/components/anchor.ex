defmodule ZoonkWeb.Components.Anchor do
  @moduledoc """
  Provides the UI for rendering anchors.
  """
  use Phoenix.Component

  import ZoonkWeb.Components.Icon

  attr :class, :string, default: nil, doc: "CSS class to apply to the anchor"
  attr :weight, :atom, values: [:normal, :medium], default: :medium, doc: "Font weight of the anchor"
  attr :kind, :atom, values: [:link, :button, :icon], default: :link, doc: "Kind of anchor to render"
  attr :variant, :atom, values: [:primary, :outline, :danger], default: :primary, doc: "Variant of anchor to render"
  attr :size, :atom, values: [:sm, :md, :lg], default: :md, doc: "Size of the anchor"
  attr :full, :boolean, default: false, doc: "Whether the anchor should be full width"
  attr :icon, :string, default: nil, doc: "Icon to display in the anchor"
  attr :rest, :global, include: ~w(href method navigate patch), doc: "HTML attributes to apply to the anchor"
  slot :inner_block, required: true

  @doc """
  Renders a styled link (anchor).

  ## Examples

      <.a>Send!</.a>
      <.a >Send!</.a>

      <.a kind={:icon} icon="tabler-name">
        <span >Icon</span>
      </.a>
  """
  def a(%{kind: :link} = assigns) do
    ~H"""
    <.link {@rest}>
      {render_slot(@inner_block)}
    </.link>
    """
  end

  def a(%{kind: :button} = assigns) do
    ~H"""
    <.link {@rest}>
      <.icon :if={@icon} name={@icon} />
      {render_slot(@inner_block)}
    </.link>
    """
  end

  def a(%{kind: :icon, icon: icon}) when is_nil(icon), do: raise("Icon is required for icon kind")

  def a(%{kind: :icon} = assigns) do
    ~H"""
    <.link {@rest}>
      <.icon :if={@icon} name={@icon} />
      {render_slot(@inner_block)}
    </.link>
    """
  end
end
