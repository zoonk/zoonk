defmodule ZoonkWeb.Components.Search do
  @moduledoc """
  Search components.
  """
  use Phoenix.Component
  use Gettext, backend: Zoonk.Gettext

  import ZoonkWeb.Components.Utils

  alias Phoenix.LiveView.JS

  @doc """
  Search component.

  This component renders a search box that can be used to search for items.

  ## Example

      <.search
        :if={@live_action == :search}
        id="search"
        show
        phx-change="search"
        phx-submit="search"
        empty={@search_results == []}
        on_cancel={JS.patch(~p"/admin/users")}
      >
        <.search_item id="item1" name="Item 1" />
        <.search_item id="item2" name="Item 2" />
      </.search>
  """
  attr :id, :string, required: true, doc: "the id of the search box container"
  attr :show, :boolean, default: false, doc: "whether to show the search box on mount"
  attr :on_cancel, JS, default: %JS{}, doc: "the JS command to run when the search box is canceled"
  attr :empty, :boolean, default: true, doc: "whether the search results are empty"
  attr :rest, :global, doc: "the rest of the attributes"

  slot :inner_block, required: true, doc: "the inner block that renders the search box content"

  def search(assigns) do
    ~H"""
    <form
      id={@id}
      phx-mounted={@show && show_modal(@id)}
      phx-remove={hide_modal(@id)}
      data-cancel={JS.exec(@on_cancel, "phx-remove")}
      {@rest}
    >
      <div id={"#{@id}-bg"} aria-hidden="true" />

      <div
        aria-labelledby={"#{@id}-title"}
        aria-describedby={"#{@id}-description"}
        role="dialog"
        aria-modal="true"
        tabindex="0"
      >
        <div>
          <div>
            <.focus_wrap
              id={"#{@id}-container"}
              phx-window-keydown={JS.exec("data-cancel", to: "##{@id}")}
              phx-key="escape"
              phx-click-away={JS.exec("data-cancel", to: "##{@id}")}
            >
              <div id={"#{@id}-content"}>
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    fill-rule="evenodd"
                    d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                    clip-rule="evenodd"
                  />
                </svg>

                <input
                  type="text"
                  name="query"
                  placeholder={gettext("Search...")}
                  role="combobox"
                  aria-expanded="false"
                  aria-controls="options"
                  phx-debounce
                />
              </div>

              <ul :if={!@empty} id="options" role="listbox">
                {render_slot(@inner_block)}
              </ul>

              <p :if={@empty}>
                {gettext("No results found.")}
              </p>
            </.focus_wrap>
          </div>
        </div>
      </div>
    </form>
    """
  end

  attr :id, :string, required: true, doc: "the id of the search item"
  attr :name, :string, required: true, doc: "the label of the search item"
  attr :rest, :global, include: ~w(href method navigate patch)

  def search_item(assigns) do
    ~H"""
    <li id={@id} role="option" tabindex="-1">
      <.link {@rest}>{@name}</.link>
    </li>
    """
  end
end
