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
  attr :size, :atom, values: [:adaptive, :sm, :md, :lg], default: :sm
  attr :class, :string, default: nil
  attr :rest, :global, include: ~w(disabled form name value)

  slot :inner_block, required: true

  def button(%{kind: :button} = assigns) do
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
        @size == :sm && "h-8 px-3 text-sm",
        @size == :md && "px-4.5 h-10",
        @size == :lg && "h-12 px-6 text-lg",
        @size == :adaptive && "size-8 text-sm sm:h-8 sm:w-auto sm:px-3",
        @class
      ]}
      {@rest}
    >
      <.icon
        :if={@icon}
        name={@icon}
        size={icon_size(@size)}
        class={[
          @icon_align == :left && "absolute left-4",
          @icon_align == :right && "absolute right-4",
          @icon_align == :auto && "sm:-ml-1"
        ]}
      />

      <span class={[@size == :adaptive && "hidden sm:inline"]}>{render_slot(@inner_block)}</span>
    </button>
    """
  end

  def button(%{kind: :icon} = assigns) do
    ~H"""
    <button
      type={@type}
      class={[
        "zk-btn rounded-full",
        "disabled:pointer-events-none disabled:opacity-50",
        @variant == :primary && "zk-btn-primary",
        @variant == :destructive && "zk-btn-destructive",
        @variant == :outline && "zk-btn-outline",
        @size == :sm && "size-8",
        @size == :md && "size-10",
        @size == :lg && "size-12",
        @class
      ]}
      {@rest}
    >
      <.icon :if={@icon} size={icon_size(@size)} name={@icon} />
      <span class="sr-only">{render_slot(@inner_block)}</span>
    </button>
    """
  end

  defp icon_size(:sm), do: :xs
  defp icon_size(:md), do: :sm
  defp icon_size(:lg), do: :md
end
