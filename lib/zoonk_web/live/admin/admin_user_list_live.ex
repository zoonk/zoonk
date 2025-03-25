defmodule ZoonkWeb.Admin.AdminUserListLive do
  @moduledoc false
  use ZoonkWeb, :live_view
  use ZoonkWeb.Pagination, as: :users

  alias Zoonk.Accounts.User
  alias Zoonk.Admin

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.Admin.AdminLayout.render
      flash={@flash}
      back={%{label: dgettext("admin", "app"), link: ~p"/"}}
      page_title={@page_title}
      active_page={:users}
    >
      <ul
        role="list"
        id="user-list"
        phx-update="stream"
        phx-viewport-top={@page > 1 && "prev-page"}
        phx-viewport-bottom={!@end_of_timeline? && "next-page"}
        phx-page-loading
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <.card :for={{dom_id, user} <- @streams.users} tag="li" id={dom_id}>
          <.card_content class="flex gap-4">
            <div class="flex flex-1 flex-col">
              <.text tag="h3" size={:title}>{User.get_display_name(user.profile)}</.text>

              <.text tag="span" size={:caption} variant={:secondary} class="italic">
                @{user.profile.username} - {user.email}
              </.text>

              <.a kind={:button} size={:sm} navigate={~p"/admin/users/#{user.id}"} class="mt-4">
                {dgettext("admin", "View")}
              </.a>
            </div>

            <.avatar
              src={user.profile.picture_url}
              size={:md}
              alt={User.get_display_name(user.profile)}
            />
          </.card_content>
        </.card>
      </ul>
    </ZoonkWeb.Admin.AdminLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket =
      socket
      |> assign(page_title: dgettext("admin", "Users"))
      |> add_pagination()

    {:ok, socket}
  end

  defp paginate(socket, new_page) when new_page >= 1 do
    %{per_page: per_page} = socket.assigns
    users = Admin.list_users(offset: (new_page - 1) * per_page, limit: per_page)
    paginate(socket, new_page, users)
  end
end
