defmodule ZoonkWeb.Components.Anchor do
  @moduledoc """
  Provides the UI for rendering anchors.
  """
  use Phoenix.Component
  use Gettext, backend: Zoonk.Gettext

  import ZoonkWeb.Components.Icon

  attr :class, :any, default: nil, doc: "CSS class to apply to the anchor"
  attr :kind, :atom, values: [:link, :button, :icon], default: :link, doc: "Kind of anchor to render"

  attr :variant, :atom,
    values: [:primary, :outline, :destructive, :secondary],
    default: :primary,
    doc: "Variant of anchor to render"

  attr :size, :atom, values: [:adaptive, :sm, :md, :lg], default: :sm, doc: "Size of the anchor"
  attr :icon, :string, default: nil, doc: "Icon to display in the anchor"
  attr :icon_align, :atom, values: [:left, :right, :auto], default: :auto, doc: "Icon alignment in the anchor"
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
    <.link
      class={[
        "zk-btn",
        @icon_align in [:left, :right] && "relative",
        @variant == :primary && "zk-btn-primary",
        @variant == :destructive && "zk-btn-destructive",
        @variant == :secondary && "zk-btn-secondary",
        @variant == :outline && "zk-btn-outline",
        @size == :sm && "h-8 px-3",
        @size == :md && "h-10 px-3",
        @size == :lg && "h-12 px-6",
        @size == :adaptive && "size-8 sm:h-8 sm:w-auto sm:px-3",
        @class
      ]}
      {@rest}
    >
      <.icon
        :if={@icon}
        size={:xs}
        name={@icon}
        class={[
          @icon_align == :left && "absolute left-4",
          @icon_align == :right && "absolute right-4"
        ]}
      />

      <span class={[@size == :adaptive && "hidden sm:inline"]}>{render_slot(@inner_block)}</span>
    </.link>
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

  @doc """
  Renders a back link.

  ## Examples

      <.back_link navigate={~p"/"} />
      <.back_link navigate={~p"/"} />
  """
  attr :label, :string, default: gettext("Back"), doc: "Label for the back link"
  attr :rest, :global, include: ~w(href method navigate patch), doc: "HTML attributes to apply to the anchor"

  def back_link(assigns) do
    ~H"""
    <.a kind={:icon} icon="tabler-arrow-left" variant={:outline} {@rest}>
      <span class="sr-only">{@label}</span>
    </.a>
    """
  end
end
