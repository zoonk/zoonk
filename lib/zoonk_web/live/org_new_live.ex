defmodule ZoonkWeb.OrgNewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  on_mount {ZoonkWeb.UserAuthorization, :ensure_org_member}

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.AppLayout.render flash={@flash} scope={@scope}>
      <div class="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 text-center">
        <.text tag="h1" size={:xxl}>{dgettext("orgs", "Create a new organization")}</.text>
      </div>
    </ZoonkWeb.AppLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    {:ok, assign(socket, :page_title, dgettext("page_title", "Create an organization"))}
  end
end
