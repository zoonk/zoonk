defmodule ZoonkWeb.Components.SearchButton do
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
      <.link
        patch={@patch}
        class={[
          "flex h-8 items-center gap-3 rounded-lg px-2 text-left ring-1",
          "sm:w-56",
          "bg-zk-surface dark:bg-zk-surface-inverse",
          "text-zk-text-secondary/50",
          "ring-zk-border contrast-more:ring-zk-border-focus",
          "dark:ring-zk-border-inverse dark:contrast-more:ring-zk-border",
          "hover:shadow-sm dark:hover:ring-zk-border-focus",
          "focus-visible:ring-zk-primary"
        ]}
      >
        <svg
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
          stroke-linecap="round"
          stroke-linejoin="round"
          class={[
            "flex-none",
            "text-zk-text-secondary/40 contrast-more:text-zk-text-primary",
            "dark:text-zk-text-secondary dark:contrast-more:text-zk-text-inverse-contrast"
          ]}
          aria-hidden="true"
        >
          <path d="m19 19-3.5-3.5"></path>
          <circle cx="11" cy="11" r="6"></circle>
        </svg>

        <span class="hidden text-sm contrast-more:text-zk-text-primary dark:contrast-more:text-zk-text-inverse-contrast sm:flex sm:w-full sm:justify-between">
          <span class="flex-auto">{gettext("Search...")}</span>
          <abbr title="Command" class="flex items-center no-underline">
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
