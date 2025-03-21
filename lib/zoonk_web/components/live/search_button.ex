defmodule ZoonkWeb.LiveComponents.SearchButton do
  @moduledoc """
  LiveComponent for the search button.

  This button allows users to navigate to a search page/modal
  when clicked or using Cmd/Ctrl + K.
  """
  use ZoonkWeb, :live_component

  attr :class, :string, default: nil, doc: "the optional additional classes to add to the button element"
  attr :patch, :string, required: true, doc: "the path to patch to when the button is clicked"

  @impl Phoenix.LiveComponent
  def render(assigns) do
    ~H"""
    <div id="search-button" phx-target={@myself} phx-window-keydown="open" class={@class}>
      <.link patch={@patch}>
        <svg
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m19 19-3.5-3.5"></path>
          <circle cx="11" cy="11" r="6"></circle>
        </svg>

        <span>
          <span>{gettext("Search...")}</span>
          <abbr title="Command">
            ⌘ K
          </abbr>
        </span>
      </.link>
    </div>
    """
  end

  @impl Phoenix.LiveComponent
  def handle_event("open", %{"ctrlKey" => true, "key" => "k"}, socket) do
    {:noreply, push_patch(socket, to: socket.assigns.patch)}
  end

  def handle_event("open", %{"metaKey" => true, "key" => "k"}, socket) do
    {:noreply, push_patch(socket, to: socket.assigns.patch)}
  end

  def handle_event("open", _params, socket) do
    {:noreply, socket}
  end
end
