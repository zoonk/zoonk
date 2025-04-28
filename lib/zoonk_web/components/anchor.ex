defmodule ZoonkWeb.Components.Anchor do
  @moduledoc """
  Provides the UI for rendering anchors.
  """
  use Phoenix.Component

  import ZoonkWeb.Components.Icon

  attr :class, :any, default: nil, doc: "CSS class to apply to the anchor"
  attr :kind, :atom, values: [:link, :button, :icon], default: :link, doc: "Kind of anchor to render"
  attr :variant, :atom, values: [:primary, :outline, :destructive], default: :primary, doc: "Variant of anchor to render"
  attr :size, :atom, values: [:sm, :md, :lg], default: :md, doc: "Size of the anchor"
  attr :icon, :string, default: nil, doc: "Icon to display in the anchor"
  attr :icon_align, :atom, values: [:left, :right, :auto], default: :auto, doc: "Icon alignment in the anchor"
  attr :icon_on_mobile, :boolean, default: false, doc: "Show only the icon on mobile"
  attr :rest, :global, include: ~w(href method navigate patch), doc: "HTML attributes to apply to the anchor"
  slot :inner_block, required: true

  @doc """
  Renders a styled link (anchor).

  ## Examples

      <.a>Send!</.a>
      <.a >Send!</.a>

      <.a kind={:icon} icon="tabler-name">
        <span class="sr-only">Icon</span>
      </.a>
  """
  def a(%{kind: :link} = assigns) do
    ~H"""
    <.link
      class={[
        "underline underline-offset-2",
        "text-zk-primary-text hover:opacity-70",
        "ring-zk-primary-text ring-offset-2",
        "focus-visible:no-underline focus-visible:outline-0 focus-visible:ring-1",
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
    <div>
      <.link
        class={[
          "zk-btn",
          @icon_on_mobile && "hidden md:flex",
          @icon_align in [:left, :right] && "relative",
          @variant == :primary && "zk-btn-primary",
          @variant == :destructive && "zk-btn-destructive",
          @variant == :outline && "zk-btn-outline",
          @size == :sm && "h-8 px-4 text-xs",
          @size == :md && "h-10 px-4 text-sm",
          @size == :lg && "text-md h-12 px-6",
          @class
        ]}
        {@rest}
      >
        <.icon
          :if={@icon}
          size={:sm}
          name={@icon}
          class={[
            @icon_align == :left && "absolute left-4",
            @icon_align == :right && "absolute right-4"
          ]}
        />
        {render_slot(@inner_block)}
      </.link>

      <.a
        :if={@icon_on_mobile}
        kind={:icon}
        variant={@variant}
        size={@size}
        icon={@icon}
        class={["md:hidden", @class]}
        {@rest}
      >
        {render_slot(@inner_block)}
      </.a>
    </div>
    """
  end

  def a(%{kind: :icon, icon: icon}) when is_nil(icon), do: raise("Icon is required for icon kind")

  def a(%{kind: :icon} = assigns) do
    ~H"""
    <.link
      class={[
        "zk-btn rounded-full",
        @variant == :primary && "zk-btn-primary",
        @variant == :destructive && "zk-btn-destructive",
        @variant == :outline && "zk-btn-shadow",
        @size == :sm && "size-8",
        @size == :md && "size-10",
        @size == :lg && "size-12",
        @class
      ]}
      {@rest}
    >
      <.icon :if={@icon} size={@size} name={@icon} />
      <span class="sr-only">{render_slot(@inner_block)}</span>
    </.link>
    """
  end
end
