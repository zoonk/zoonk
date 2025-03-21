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
      <.button full phx-click="go" >Send!</.button>
  """
  attr :type, :string, default: "button"
  attr :icon, :string, default: nil
  attr :variant, :atom, values: [:primary, :outline], default: :primary
  attr :size, :atom, values: [:sm, :md, :lg], default: :md
  attr :full, :boolean, default: false
  attr :class, :string, default: nil
  attr :rest, :global, include: ~w(disabled form name value)

  slot :inner_block, required: true

  def button(assigns) do
    ~H"""
    <button type={@type} {@rest}>
      <.icon :if={@icon} name={@icon} />
      {render_slot(@inner_block)}
    </button>
    """
  end
end
