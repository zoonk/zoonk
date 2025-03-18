defmodule ZoonkWeb.Live.AdminUsers do
  @moduledoc false
  use ZoonkWeb, :live_view
  use ZoonkWeb.Pagination, as: :users

  alias Zoonk.Accounts.UserProfile
  alias Zoonk.Admin

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket =
      socket
      |> assign(:page_title, dgettext("admin", "Users"))
      |> add_pagination()

    {:ok, socket}
  end

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ul
      role="list"
      id="user-list"
      phx-update="stream"
      phx-viewport-top={@page > 1 && "prev-page"}
      phx-viewport-bottom={!@end_of_timeline? && "next-page"}
      phx-page-loading
      class="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
    >
      <li
        :for={{dom_id, user} <- @streams.users}
        id={dom_id}
        class="bg-zk-surface flex gap-4 rounded-lg p-4 shadow-sm dark:bg-zk-surface-inverse"
      >
        <div class="flex-1">
          <.text element={:h3} size={:title}>{get_display_name(user.profile)}</.text>

          <.text element={:span} size={:caption} variant={:secondary} class="italic">
            @{user.profile.username} - {user.email}
          </.text>
        </div>

        <.avatar
          src={user.profile.picture_url}
          alt={get_display_name(user.profile)}
          label={get_display_name(user.profile)}
        />
      </li>
    </ul>
    """
  end

  defp paginate(socket, new_page) when new_page >= 1 do
    %{per_page: per_page} = socket.assigns
    users = Admin.list_users(offset: (new_page - 1) * per_page, limit: per_page)
    paginate(socket, new_page, users)
  end

  defp get_display_name(%UserProfile{display_name: nil} = profile), do: profile.username
  defp get_display_name(%UserProfile{display_name: display_name}), do: display_name
end
