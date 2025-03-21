defmodule ZoonkWeb.Live.AdminHome do
  @moduledoc false
  use ZoonkWeb, :live_view

  import ZoonkWeb.Components.Admin

  alias Zoonk.Admin

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    socket =
      socket
      |> assign(:page_title, dgettext("admin", "Dashboard"))
      |> assign(total_users: Admin.count_users())

    {:ok, socket}
  end

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <article>
      <.stats_card title={dgettext("admin", "Total users")} data={@total_users} />
    </article>
    """
  end
end
