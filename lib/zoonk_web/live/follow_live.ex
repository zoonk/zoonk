defmodule ZoonkWeb.FollowLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Config.SocialConfig

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.AppLayout.render flash={@flash} scope={@scope}>
      <div class="flex flex-col gap-2">
        <.text tag="h1" size={:xxl}>
          {dgettext("settings", "Follow us")}
        </.text>

        <.text tag="h2" size={:md} variant={:secondary}>
          {dgettext("settings", "Stay connected with us on social media for updates and news.")}
        </.text>

        <div class="grid grid-cols-2 gap-4 pt-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          <.social_link
            :for={link <- SocialConfig.get_social_links(@current_language)}
            name={link.name}
            url={link.url}
            icon={link.icon}
            handle={link.handle}
          />
        </div>
      </div>
    </ZoonkWeb.AppLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, session, socket) do
    current_language = session["language"] || "en"

    socket =
      socket
      |> assign(:page_title, dgettext("page_title", "Follow us"))
      |> assign(:current_language, current_language)

    {:ok, socket}
  end

  defp social_link(assigns) do
    ~H"""
    <a
      href={@url}
      target="_blank"
      rel="noopener noreferrer"
      class="border-zk-border bg-zk-background flex items-center gap-3 rounded border p-3 transition-colors hover:bg-zk-muted"
    >
      <.icon name={@icon} size={:md} class="text-zk-primary" />

      <div class="flex flex-col">
        <.text size={:sm} weight={:medium}>{@name}</.text>
        <.text size={:xs} variant={:secondary}>{@handle}</.text>
      </div>
    </a>
    """
  end
end
