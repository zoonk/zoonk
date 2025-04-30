defmodule ZoonkWeb.Components.Dropdown do
  @moduledoc """
  Dropdown components.
  """
  use Phoenix.Component

  alias Phoenix.LiveView.JS

  slot :inner_block, required: true, doc: "The inner block of the dropdown"

  def dropdown(assigns) do
    ~H"""
    <div class="relative inline-block">
      {render_slot(@inner_block)}
    </div>
    """
  end

  slot :inner_block, required: true, doc: "The inner block of the dropdown trigger"

  def dropdown_trigger(assigns) do
    ~H"""
    <button phx-click={toggle_dropdown("dropdown-content")} aria-expanded="false">
      {render_slot(@inner_block)}
    </button>
    """
  end

  slot :inner_block, required: true, doc: "The inner block of the dropdown content"

  def dropdown_content(assigns) do
    ~H"""
    <.focus_wrap
      id="dropdown-content"
      phx-click-away={hide_dropdown("dropdown-content")}
      phx-window-keydown={hide_dropdown("dropdown-content")}
      phx-key="Escape"
      class="bg-zk-surface ring-zk-border absolute z-10 mt-2 hidden w-48 rounded-md shadow-lg ring-1 focus:outline-none"
    >
      {render_slot(@inner_block)}
    </.focus_wrap>
    """
  end

  defp toggle_dropdown(js \\ %JS{}, id) do
    JS.toggle(js,
      to: "##{id}",
      time: 200,
      in: {"transition-all transform ease-out duration-300", "opacity-0", "opacity-100"},
      out: {"transition-all transform ease-in duration-200", "opacity-100", "opacity-0"}
    )
  end

  defp hide_dropdown(js \\ %JS{}, id) do
    JS.hide(js,
      to: "##{id}",
      time: 200,
      transition:
        {"transition-all transform ease-in duration-200", "opacity-100 translate-y-0 sm:scale-100",
         "opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"}
    )
  end
end
