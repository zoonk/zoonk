defmodule ZoonkWeb.Admin.AdminHomeLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  import ZoonkWeb.Admin.AdminComponents

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
    <ZoonkWeb.Admin.AdminLayout.render
      flash={@flash}
      back={%{label: dgettext("admin", "app"), link: ~p"/"}}
      page_title={@page_title}
      active_page={:home}
    >
      <article class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <.stats_card title={dgettext("admin", "Total users")} data={@total_users} />
      </article>
    </ZoonkWeb.Admin.AdminLayout.render>
    """
  end
end
