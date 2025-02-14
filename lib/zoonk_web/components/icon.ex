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
      <.icon name="tabler-refresh" class="ml-1 w-3 h-3 animate-spin" />
  """
  attr :name, :string, required: true
  attr :class, :string, default: nil

  def icon(%{name: "tabler-" <> _rest} = assigns) do
    ~H"""
    <span class={[@name, @class]} />
    """
  end
end
