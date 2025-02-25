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
      <.button phx-click="go" class="ml-2">Send!</.button>
  """
  attr :type, :string, default: nil
  attr :class, :string, default: nil
  attr :rest, :global, include: ~w(disabled form name value)

  slot :inner_block, required: true

  def button(assigns) do
    ~H"""
    <button
      type={@type}
      class={[
        "rounded-lg bg-zinc-900 px-3 py-2 hover:bg-zinc-700 phx-submit-loading:opacity-75",
        "text-sm font-semibold leading-6 text-white active:text-white/80",
        @class
      ]}
      {@rest}
    >
      {render_slot(@inner_block)}
    </button>
    """
  end

  attr :id, :string, default: nil
  attr :class, :string, default: nil
  attr :icon, :string, default: nil
  attr :rest, :global, include: ~w(href method navigate patch)
  attr :variant, :atom, values: [:primary, :outline], default: :primary

  slot :inner_block

  @doc """
  Renders a link styled as a button.

  ## Examples

      <.link_as_button>Send!</.link_as_button>
      <.link_as_button class="ml-2">Send!</.link_as_button>
  """
  def link_as_button(assigns) do
    ~H"""
    <.link
      id={@id}
      class={[
        "relative h-12 whitespace-nowrap rounded-md px-10 ring",
        "inline-flex items-center justify-center gap-2",
        "text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-1",
        "disabled:pointer-events-none disabled:opacity-50",
        @variant == :outline &&
          "ring-zk-border text-zk-text-primary/85 bg-zk-surface hover:text-zk-text-primary hover:bg-zk-surface-hover",
        @class
      ]}
      {@rest}
    >
      <.icon :if={@icon} name={@icon} class="absolute left-4 h-5 w-5" />
      {render_slot(@inner_block)}
    </.link>
    """
  end
end
