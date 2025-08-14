defmodule ZoonkWeb.Components.Icon do
  @moduledoc """
  Provides the UI for rendering icons.
  """
  use Phoenix.Component

  @icon_path %{
    filled: Path.expand("deps/tabler_icons/icons/filled"),
    outline: Path.expand("deps/tabler_icons/icons/outline")
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
  attr :size, :atom, values: [:xs, :sm, :md, :lg], default: :sm, doc: "Icon size, e.g. `:sm`, `:md`, `:lg`"
  attr :label, :string, default: nil, doc: "Accessible label for the icon"

  def icon(%{name: "tabler-" <> _rest} = assigns) do
    ~H"""
    <span
      class={[
        @name,
        @size == :xs && "size-4",
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
  user input or other runtime data like AI's suggestions.

  We can use this component to load icons dynamically.

  ## Examples

      <.dynamic_icon name="tabler-x" />
      <.dynamic_icon name="tabler-refresh" />
  """
  attr :name, :string, required: true
  attr :variant, :atom, default: :outline, values: [:outline, :filled]
  attr :default, :string, required: true, doc: "Default icon name to use if the icon is not found"
  attr :class, :any, default: nil

  def dynamic_icon(assigns) do
    ~H"""
    <div class={@class}>
      {Phoenix.HTML.raw(load_svg(@name, @variant, @default))}
    </div>
    """
  end

  defp load_svg(name, variant, default) do
    alt_variant = if variant == :outline, do: :filled, else: :outline

    read_svg(name, variant) ||
      read_svg(name, alt_variant) ||
      read_svg(default, variant) ||
      read_svg(default, alt_variant)
  end

  defp read_svg(nil, _variant), do: nil

  # sobelow_skip ["Traversal.FileModule"]
  defp read_svg(name, variant) do
    dir = Map.fetch!(@icon_path, variant)

    safe_name =
      name
      |> String.replace_prefix("tabler-", "")
      |> Kernel.<>(".svg")

    path = Path.join(dir, safe_name)

    case File.read(path) do
      {:ok, content} -> String.replace(content, ~r/\s(width|height)="[^"]*"/, "")
      _error -> nil
    end
  end
end
