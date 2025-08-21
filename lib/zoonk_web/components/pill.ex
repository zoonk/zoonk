defmodule ZoonkWeb.Components.Pill do
  @moduledoc """
  Provides the UI for rendering pill-shaped navigation elements.
  """
  use Phoenix.Component

  import ZoonkWeb.Components.Icon

  @doc """
  Renders a pill component for navigation.

  ## Examples

      <.pill navigate="/home" icon="tabler-home" active>
        Home
      </.pill>

      <.pill navigate="/settings" icon="tabler-settings" color="text-blue-500">
        Settings
      </.pill>
  """
  attr :icon, :string, required: true, doc: "Icon name for the pill"
  attr :color, :string, default: "text-gray-500", doc: "Color class for inactive state"
  attr :active, :boolean, default: false, doc: "Whether the pill is in active state"
  attr :class, :string, default: nil, doc: "Additional CSS classes"
  attr :rest, :global, include: ~w(href method navigate patch), doc: "HTML attributes to apply to the anchor"
  slot :inner_block, required: true, doc: "Content to render inside the pill"

  def pill(assigns) do
    ~H"""
    <li class={[
      "rounded-full px-3 py-1.5 leading-none tracking-tight shadow-sm",
      "focus-within:ring-zk-border focus-within:ring-2 focus-within:ring-offset-2",
      "transition-transform hover:scale-105",
      @active && "bg-zk-primary shadow-zk-primary",
      !@active && "bg-zk-background",
      @class
    ]}>
      <.link
        class={[
          "inline-flex items-center gap-1 align-middle focus:outline-0",
          @active && "text-zk-primary-foreground"
        ]}
        {@rest}
      >
        <.icon name={@icon} class={["size-4", !@active && @color]} />

        <span class={["text-xs", !@active && "text-zk-foreground"]}>
          {render_slot(@inner_block)}
        </span>
      </.link>
    </li>
    """
  end
end
