defmodule ZoonkWeb.Components.Icon do
  @moduledoc """
  Provides the UI for rendering icons.
  """
  use Phoenix.Component

  @doc """
  Renders a [Tabler Icon](https://tabler-icons.io/).

  Icons are extracted from the `deps/tabler_icons` directory and bundled within
  your compiled app.css by the plugin in your `assets/tailwind.config.js`.

  ## Examples

      <.icon name="tabler-x" />
      <.icon name="tabler-refresh"  />
  """
  attr :name, :string, required: true, doc: "Icon name, e.g. `tabler-x`"
  attr :class, :any, default: nil, doc: "Additional CSS classes to apply to the icon"
  attr :size, :atom, values: [:sm, :md, :lg], default: :sm, doc: "Icon size, e.g. `:sm`, `:md`, `:lg`"
  attr :label, :string, default: nil, doc: "Accessible label for the icon"

  def icon(%{name: "tabler-" <> _rest} = assigns) do
    ~H"""
    <span
      class={[
        @name,
        @size == :sm && "size-5",
        @size == :md && "size-6",
        @size == :lg && "size-8",
        @class
      ]}
      aria-label={@label}
      aria-hidden={is_nil(@label)}
    />
    """
  end
end
