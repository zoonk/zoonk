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
  attr :name, :string, required: true
  attr :class, :any, default: nil
  attr :size, :atom, values: [:sm, :md, :lg], default: :sm

  def icon(%{name: "tabler-" <> _rest} = assigns) do
    ~H"""
    <span class={[
      @name,
      @size == :sm && "size-5",
      @size == :md && "size-7",
      @size == :lg && "size-9",
      @class
    ]} />
    """
  end
end
