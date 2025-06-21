defmodule ZoonkWeb.Components.Button do
  @moduledoc """
  Provides the UI for rendering buttons.
  """
  use Phoenix.Component

  import ZoonkWeb.Components.Icon

  @doc """
  Renders a button.

  ## Examples

      <.button>Send!</.button>
      <.button variant={:outline}>Send!</.button>
  """
  attr :type, :string, default: "button"
  attr :kind, :atom, values: [:button, :icon], default: :button
  attr :icon, :string, default: nil
  attr :icon_align, :atom, values: [:left, :right, :auto], default: :auto
  attr :variant, :atom, values: [:primary, :destructive, :secondary, :outline], default: :primary
  attr :size, :atom, values: [:sm, :md, :lg], default: :sm
  attr :class, :string, default: nil
  attr :rest, :global, include: ~w(disabled form name value)

  slot :inner_block, required: true

  def button(assigns) do
    ~H"""
    <button
      type={@type}
      class={[
        "zk-btn",
        "disabled:pointer-events-none disabled:opacity-50",
        @icon_align in [:left, :right] && "relative",
        @variant == :primary && "zk-btn-primary",
        @variant == :destructive && "zk-btn-destructive",
        @variant == :secondary && "zk-btn-secondary",
        @variant == :outline && "zk-btn-outline",
        @size == :sm && @kind == :button && "h-8 px-3",
        @size == :md && @kind == :button && "h-10 px-3",
        @size == :lg && @kind == :button && "h-12 px-6",
        @size == :sm && @kind == :icon && "size-8",
        @size == :md && @kind == :icon && "size-10",
        @size == :lg && @kind == :icon && "size-12",
        @class
      ]}
      {@rest}
    >
      <.icon
        :if={@icon}
        name={@icon}
        size={if @kind == :button, do: :sm, else: :xs}
        class={[
          @icon_align == :left && "absolute left-4",
          @icon_align == :right && "absolute right-4"
        ]}
      />
      {render_slot(@inner_block)}
    </button>
    """
  end
end
