defmodule ZoonkWeb.Components.Button do
  @moduledoc """
  Provides the UI for rendering buttons.
  """
  use Phoenix.Component

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
end
