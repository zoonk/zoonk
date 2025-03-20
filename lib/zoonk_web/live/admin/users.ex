defmodule ZoonkWeb.Live.AdminUsers do
  @moduledoc false
  use ZoonkWeb, :live_view
  use ZoonkWeb.Pagination, as: :users

  alias Zoonk.Accounts.User
  alias Zoonk.Admin

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <article>
      <ul
        role="list"
        id="user-list"
        phx-update="stream"
        phx-viewport-top={@page > 1 && "prev-page"}
        phx-viewport-bottom={!@end_of_timeline? && "next-page"}
        phx-page-loading
        class="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <.card :for={{dom_id, user} <- @streams.users} tag="li" id={dom_id} class="flex gap-4">
          <div class="flex-1">
            <.text element={:h3} size={:title}>{User.get_display_name(user.profile)}</.text>

            <.text element={:span} size={:caption} variant={:secondary} class="italic">
              @{user.profile.username} - {user.email}
            </.text>
          </div>

          <.avatar
            src={user.profile.picture_url}
            alt={User.get_display_name(user.profile)}
            label={User.get_display_name(user.profile)}
          />
        </.card>
      </ul>

      <.search
        :if={@live_action == :search}
        phx-change="search"
        phx-submit="search"
        empty={@search_results == []}
        id="user-search"
        show
        on_cancel={JS.patch(~p"/admin/users")}
      >
        <.search_item
          :for={user <- @search_results}
          id={"user-search-#{user.id}"}
          navigate={~p"/admin/users/#{user.id}"}
          name={User.get_display_name(user.profile)}
        />
      </.search>
    </article>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket =
      socket
      |> assign(page_title: page_title(socket.assigns.live_action))
      |> assign(search_link: ~p"/admin/users/search")
      |> add_pagination()

    {:ok, socket}
  end

  @impl Phoenix.LiveView
  def handle_params(params, _uri, socket) do
    %{live_action: live_action} = socket.assigns

    socket =
      socket
      |> assign(:page_title, page_title(live_action))
      |> assign(:search_results, Admin.search_users(params["query"]))

    {:noreply, socket}
  end

  defp paginate(socket, new_page) when new_page >= 1 do
    %{per_page: per_page} = socket.assigns
    users = Admin.list_users(offset: (new_page - 1) * per_page, limit: per_page)
    paginate(socket, new_page, users)
  end

  def handle_event("search", %{"query" => search_query}, socket) do
    {:noreply, push_patch(socket, to: ~p"/admin/users/search?query=#{search_query}")}
  end

  defp page_title(:search), do: dgettext("admin", "Search users")
  defp page_title(_live_action), do: dgettext("admin", "Users")
end
