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
      class="relative inline-block shrink-0 cursor-pointer"
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
        "bg-zk-background ring-zk-border absolute z-50 mt-2 hidden w-48 rounded-md p-1 shadow-md ring-1 focus:outline-none",
        @position == :left && "left-0",
        @position == :right && "right-0"
      ]}
    >
      <div role="menu" class="flex flex-col">
        {render_slot(@inner_block)}
      </div>
    </.focus_wrap>
    """
  end

  attr :icon, :string, default: nil, doc: "Optional icon to display in the dropdown item"
  attr :variant, :atom, values: [:default, :destructive], default: :default, doc: "Variant of the dropdown item. "
  attr :rest, :global, include: ~w(href method navigate patch), doc: "HTML attributes to apply to the dropdown item"
  slot :inner_block, required: true, doc: "The inner block of the dropdown item"

  def dropdown_item(assigns) do
    ~H"""
    <div role="menuitem">
      <.link
        class={[
          "flex select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
          "hover:bg-zk-muted focus-visible:bg-zk-muted",
          @variant == :default && "text-zk-foreground",
          @variant == :destructive && "text-zk-destructive-text"
        ]}
        {@rest}
      >
        <.icon :if={@icon} size={:xs} name={@icon} />

        {render_slot(@inner_block)}
      </.link>
    </div>
    """
  end

  def dropdown_separator(assigns) do
    ~H"""
    <div class="bg-zk-border -mx-1 my-1 h-px" />
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
