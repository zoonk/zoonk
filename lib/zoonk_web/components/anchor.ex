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
      <.a class="ml-2">Send!</.a>

      <.a kind={:icon} icon="tabler-name">
        <span class="sr-only">Icon</span>
      </.a>
  """
  def a(%{kind: :link} = assigns) do
    ~H"""
    <.link
      class={[
        @weight == :normal && "font-normal",
        @weight == :medium && "font-medium",
        "text-zk-link",
        "hover:text-zk-link-hover hover:underline",
        "active:text-zk-link-active",
        "focus-visible:text-zk-link-hover focus-visible:underline",
        "dark:text-zk-link-inverse dark:hover:text-zk-link-inverse",
        "dark:focus-visible:text-zk-link-inverse",
        "dark:active:text-zk-link-inverse",
        "contrast-more:text-zk-link-active",
        "contrast-more:hover:text-zk-link-hover",
        "contrast-more:focus-visible:text-zk-link-hover",
        "dark:contrast-more:text-zk-link-inverse-hover",
        "dark:contrast-more:hover:text-zk-link-inverse",
        @class
      ]}
      {@rest}
    >
      {render_slot(@inner_block)}
    </.link>
    """
  end

  def a(%{kind: :button} = assigns) do
    ~H"""
    <.link
      class={[
        "zk-btn",
        @full && "relative w-full",
        @variant == :outline && "zk-btn-outline",
        @variant == :primary && "zk-btn-primary",
        @variant == :danger && "zk-btn-danger",
        @size == :sm && "zk-btn-sm",
        @size == :md && "zk-btn-md",
        @size == :lg && "zk-btn-lg",
        @class
      ]}
      {@rest}
    >
      <.icon :if={@icon} name={@icon} class={[@full && "absolute left-4", "h-5 w-5"]} />
      {render_slot(@inner_block)}
    </.link>
    """
  end

  def a(%{kind: :icon, icon: icon}) when is_nil(icon), do: raise("Icon is required for icon kind")

  def a(%{kind: :icon} = assigns) do
    ~H"""
    <.link
      class={[
        "zk-btn size-8 px-0",
        @variant == :outline && "zk-btn-outline",
        @variant == :primary && "zk-btn-primary",
        @variant == :danger && "zk-btn-danger",
        @class
      ]}
      {@rest}
    >
      <.icon :if={@icon} name={@icon} class="h-5 w-5" />
      {render_slot(@inner_block)}
    </.link>
    """
  end
end
