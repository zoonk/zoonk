defmodule ZoonkWeb.Components.Dialog do
  @moduledoc """
  Dialog components.
  """
  use Phoenix.Component

  alias Phoenix.LiveView.JS

  @doc """
  Renders a dialog component.

  ## Examples

      <.dialog id="my-dialog">
        content
      </.dialog>
  """
  attr :id, :string, default: nil, doc: "The unique identifier for the dialog"
  attr :class, :any, default: nil, doc: "Additional CSS classes for the dialog"

  slot :inner_block, required: true, doc: "The content of the dialog"

  def dialog(assigns) do
    ~H"""
    <dialog
      id={@id}
      class={[
        "max-h-[85vh] w-[90vw] overflow-hidden",
        "fixed z-50 rounded p-0 shadow-lg",
        "bg-zk-surface text-zk-surface-foreground",
        "backdrop:bg-zk-background/20 backdrop:backdrop-blur-sm",
        "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
        "md:max-w-md",
        @class
      ]}
    >
      <.focus_wrap id={"#{@id}-container"} phx-click-away={JS.dispatch("closeDialog")}>
        {render_slot(@inner_block)}
      </.focus_wrap>
    </dialog>
    """
  end
end
