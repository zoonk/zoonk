defmodule ZoonkWeb.Components.Icon do
  @moduledoc """
  Provides the UI for rendering icons.
  """
  use Phoenix.Component

  @icon_path %{
    filled: Path.expand("deps/tabler_icons/icons/filled"),
    outlined: Path.expand("deps/tabler_icons/icons/outline")
  }

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

  @doc """
  Renders a dynamic icon.

  `<.icon />` only allows us to render icons at compile time.

  Sometimes we need to dynamically load icons based on
  user input or other runtime data like AI's recommendations.

  We can use this component to load icons dynamically.

  ## Examples

      <.dynamic_icon name="tabler-x" />
      <.dynamic_icon name="tabler-refresh" />
  """
  attr :name, :string, required: true
  attr :style, :atom, default: :outlined, values: [:outlined, :filled]
  attr :class, :string, default: nil

  def dynamic_icon(%{name: "tabler-" <> _rest} = assigns) do
    ~H"""
    <div class={@class}>
      {Phoenix.HTML.raw(load_svg(@name, @style))}
    </div>
    """
  end

  # sobelow_skip ["Traversal.FileModule"]
  defp load_svg(name, style) do
    dir = Map.fetch!(@icon_path, style)
    icon_name = String.replace_prefix(name, "tabler-", "")
    basename = Path.basename(icon_name <> ".svg")
    path = Path.join(dir, basename)
    File.read!(path)
  end
end
