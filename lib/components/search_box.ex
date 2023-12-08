# credo:disable-for-this-file Credo.Check.Readability.Specs

defmodule UneebeeWeb.Components.SearchBox do
  @moduledoc """
  Search box components.
  """
  use Phoenix.Component

  import UneebeeWeb.Components.Utils

  alias Phoenix.LiveView.JS

  attr :id, :string, required: true, doc: "the id of the search box container"
  attr :show, :boolean, default: false, doc: "whether to show the search box on mount"
  attr :on_cancel, JS, default: %JS{}, doc: "the JS command to run when the search box is canceled"
  attr :empty, :boolean, default: true, doc: "whether the search results are empty"

  slot :inner_block, required: true, doc: "the inner block that renders the search box content"

  def search_box(assigns) do
    ~H"""
    <div id={@id} phx-mounted={@show && show_search_box(@id)} phx-remove={hide_search_box(@id)} data-cancel={JS.exec(@on_cancel, "phx-remove")} class="relative z-50 hidden">
      <div id={"#{@id}-bg"} class="bg-gray-50/90 fixed inset-0 transition-opacity" aria-hidden="true" />

      <div class="fixed inset-0 overflow-y-auto" aria-labelledby={"#{@id}-title"} aria-describedby={"#{@id}-description"} role="dialog" aria-modal="true" tabindex="0">
        <div class="min-h-dvh flex items-center justify-center">
          <div class="w-full max-w-3xl sm:p-6 lg:py-8">
            <.focus_wrap
              id={"#{@id}-container"}
              phx-window-keydown={JS.exec("data-cancel", to: "##{@id}")}
              phx-key="escape"
              phx-click-away={JS.exec("data-cancel", to: "##{@id}")}
              class="mx-auto max-w-xl transform divide-y divide-gray-100 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black ring-opacity-5 transition-all"
            >
              <div class="relative" id={"#{@id}-content"}>
                <svg class="pointer-events-none absolute top-3.5 left-4 h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    fill-rule="evenodd"
                    d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                    clip-rule="evenodd"
                  />
                </svg>

                <input
                  type="text"
                  class="h-12 w-full border-0 bg-transparent pr-4 pl-11 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm"
                  placeholder="Search..."
                  role="combobox"
                  aria-expanded="false"
                  aria-controls="options"
                />
              </div>

              <ul :if={!@empty} class="max-h-72 scroll-py-2 overflow-y-auto py-2 text-sm text-gray-800" id="options" role="listbox">
                <%= render_slot(@inner_block) %>
              </ul>

              <p :if={@empty} class="p-4 text-sm text-gray-500">No people found.</p>
            </.focus_wrap>
          </div>
        </div>
      </div>
    </div>
    """
  end

  @doc """
  Shows a search box.
  """
  def show_search_box(js \\ %JS{}, id) when is_binary(id) do
    js
    |> JS.show(to: "##{id}")
    |> JS.show(
      to: "##{id}-bg",
      transition: {"transition-all transform ease-out duration-300", "opacity-0", "opacity-100"}
    )
    |> show("##{id}-container")
    |> JS.add_class("overflow-hidden", to: "body")
    |> JS.focus_first(to: "##{id}-content")
  end

  @doc """
  Hides a search box.
  """
  def hide_search_box(js \\ %JS{}, id) do
    js
    |> JS.hide(
      to: "##{id}-bg",
      transition: {"transition-all transform ease-in duration-200", "opacity-100", "opacity-0"}
    )
    |> hide("##{id}-container")
    |> JS.hide(to: "##{id}", transition: {"block", "block", "hidden"})
    |> JS.remove_class("overflow-hidden", to: "body")
    |> JS.pop_focus()
  end
end