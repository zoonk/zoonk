defmodule ZoonkWeb.AppHomeLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.AppLayout.render
      flash={@flash}
      scope={@scope}
      page_title={@page_title}
      active_page={:home}
    >
      <!-- Placeholder for testing scroll, remove it when we have the actual page -->
      <div class="flex w-full flex-col gap-4 p-4">
        <div :for={i <- 1..50} class=" rounded-lg bg-white p-6 shadow-md">
          <h2 class="text-2xl font-bold text-gray-800">Section {i}</h2>
          <p class="text-gray-600">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent tincidunt, leo non tincidunt tristique,
            nisl nisl aliquet urna, ac sollicitudin metus risus at dolor.
          </p>
          <div class="flex space-x-4">
            <button class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
              Action 1
            </button>
            <button class="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700">
              Action 2
            </button>
            <button class="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700">
              Action 3
            </button>
          </div>
        </div>
      </div>
    </ZoonkWeb.AppLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket = assign(socket, :page_title, dgettext("content", "Summary"))

    {:ok, socket}
  end
end
