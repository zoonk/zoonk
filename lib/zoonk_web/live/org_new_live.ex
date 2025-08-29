defmodule ZoonkWeb.OrgNewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  on_mount {ZoonkWeb.UserAuthorization, :ensure_org_member}
  on_mount {ZoonkWeb.UserAuthorization, :ensure_system_org}

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.AppLayout.render flash={@flash} scope={@scope}>
      <div class="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 text-center">
        <header class="flex flex-col items-center gap-1">
          <.text tag="h1" size={:xxl}>{dgettext("orgs", "Set up your organization")}</.text>

          <.text tag="h2" size={:md} variant={:secondary}>
            {dgettext(
              "orgs",
              "Once your organization is ready, you can start creating courses for your audience, team, or school."
            )}
          </.text>
        </header>
      </div>
    </ZoonkWeb.AppLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    {:ok, assign(socket, :page_title, dgettext("page_title", "Set up your organization"))}
  end
end
