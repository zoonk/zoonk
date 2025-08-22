defmodule ZoonkWeb.UserSettingsLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias ZoonkWeb.SettingsLayout

  on_mount {ZoonkWeb.UserAuthorization, :ensure_org_member}

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <SettingsLayout.render flash={@flash} scope={@scope} current_page={:settings}>
      <div class="flex flex-col gap-2">
        <.text tag="h1" size={:xxl}>{dgettext("settings", "Settings")}</.text>

        <.text tag="h2" size={:md} variant={:secondary}>
          {dgettext("settings", "Manage your account settings and preferences.")}
        </.text>

        <div class="grid grid-cols-1 gap-4 pt-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          <.link
            :for={item <- SettingsLayout.menu_items()}
            navigate={item.path}
            class="border-zk-border bg-zk-background flex items-center gap-3 rounded border p-3 transition-colors hover:bg-zk-muted"
          >
            <.icon name={item.icon} size={:md} class="text-zk-primary-text" />

            <div class="flex flex-col">
              <.text size={:sm} weight={:medium}>{item.label}</.text>
            </div>
          </.link>
        </div>
      </div>
    </SettingsLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    {:ok, assign(socket, :page_title, dgettext("page_title", "Settings"))}
  end
end
