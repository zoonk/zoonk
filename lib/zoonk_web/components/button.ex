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
      <.button full phx-click="go" class="ml-2">Send!</.button>
  """
  attr :type, :string, default: "button"
  attr :icon, :string, default: nil
  attr :variant, :atom, values: [:primary, :outline], default: :primary
  attr :full, :boolean, default: false
  attr :class, :string, default: nil
  attr :rest, :global, include: ~w(disabled form name value)

  slot :inner_block, required: true

  def button(assigns) do
    ~H"""
    <button
      type={@type}
      class={[
        "zk-btn",
        @full && "relative w-full",
        !@full && "w-max",
        @variant == :outline && "zk-btn-outline",
        @variant == :primary && "zk-btn-primary",
        @class
      ]}
      {@rest}
    >
      <.icon :if={@icon} name={@icon} class={[@full && "absolute left-4", "h-5 w-5"]} />
      {render_slot(@inner_block)}
    </button>
    """
  end
end
