defmodule ZoonkWeb.Components.Dropdown do
  @moduledoc """
  Dropdown components.
  """
  use Phoenix.Component

  import ZoonkWeb.Components.Icon

  alias Phoenix.LiveView.JS

  attr :label, :string, required: true, doc: "Label for the dropdown"
  slot :inner_block, required: true, doc: "The inner block of the dropdown"

  def dropdown(assigns) do
    ~H"""
    <button
      role="menu"
      data-dropdown
      phx-click={toggle_dropdown()}
      class="relative inline-block cursor-pointer"
      phx-keydown={toggle_dropdown()}
      phx-key="Enter"
      aria-haspopup="true"
      aria-expanded="false"
      aria-label={@label}
    >
      {render_slot(@inner_block)}
    </button>
    """
  end

  attr :position, :atom, values: [:left, :right], default: :right, doc: "Position of the dropdown content"
  slot :inner_block, required: true, doc: "The inner block of the dropdown content"

  def dropdown_content(assigns) do
    ~H"""
    <.focus_wrap
      id="dropdown-content"
      data-dropdown-content
      phx-click-away={hide_dropdown()}
      phx-window-keydown={hide_dropdown()}
      phx-key="Escape"
      class={[
        "bg-zk-surface ring-zk-border absolute z-10 mt-2 hidden w-48 rounded-md shadow-lg ring-1 focus:outline-none",
        @position == :left && "left-0",
        @position == :right && "right-0"
      ]}
    >
      <ul class="flex flex-col">{render_slot(@inner_block)}</ul>
    </.focus_wrap>
    """
  end

  attr :icon, :string, default: nil, doc: "Optional icon to display in the dropdown item"
  attr :variant, :atom, values: [:default, :destructive], default: :default, doc: "Variant of the dropdown item. "
  attr :rest, :global, include: ~w(href method navigate patch), doc: "HTML attributes to apply to the dropdown item"
  slot :inner_block, required: true, doc: "The inner block of the dropdown item"

  def dropdown_item(assigns) do
    ~H"""
    <li>
      <.link
        class={[
          "flex items-center gap-2 rounded-md p-2 text-sm",
          "hover:bg-zk-muted/70 focus-visible:bg-zk-muted/70",
          @variant == :default && "text-zk-surface-foreground",
          @variant == :destructive && "text-zk-destructive-text"
        ]}
        {@rest}
      >
        <.icon :if={@icon} name={@icon} />

        {render_slot(@inner_block)}
      </.link>
    </li>
    """
  end

  defp toggle_dropdown(js \\ %JS{}) do
    js
    |> JS.toggle(
      to: {:inner, "[data-dropdown-content]"},
      time: 200,
      in: {"transition-all transform ease-out duration-300", "opacity-0", "opacity-100"},
      out: {"transition-all transform ease-in duration-200", "opacity-100", "opacity-0"}
    )
    |> JS.toggle_attribute({"aria-expanded", "false", "true"}, to: "[data-dropdown]")
  end

  defp hide_dropdown(js \\ %JS{}) do
    js
    |> JS.hide(
      to: "[data-dropdown-content]",
      time: 200,
      transition:
        {"transition-all transform ease-in duration-200", "opacity-100 translate-y-0 sm:scale-100",
         "opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"}
    )
    |> JS.set_attribute({"aria-expanded", "false"}, to: "[data-dropdown]")
  end
end
