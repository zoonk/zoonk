defmodule ZoonkWeb.FollowLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Support.Social

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.SettingsLayout.render flash={@flash} scope={@scope} current_page={:follow} has_form={false}>
      <div class="flex flex-col gap-2">
        <.text tag="h1" size={:xxl}>
          {dgettext("settings", "Follow us")}
        </.text>

        <.text tag="h2" size={:md} variant={:secondary}>
          {dgettext("settings", "Stay connected with us on social media for updates and news.")}
        </.text>

        <div class="grid grid-cols-2 gap-4 pt-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          <a
            :for={link <- Social.get_social_links(@current_language)}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            class="border-zk-border bg-zk-background flex items-center gap-3 rounded border p-3 transition-colors hover:bg-zk-muted"
          >
            <.icon name={get_social_icon(link.name)} size={:md} class="text-zk-primary" />

            <div class="flex flex-col">
              <.text size={:sm} weight={:medium}>{link.name}</.text>
              <.text size={:xs} variant={:secondary}>{link.handle}</.text>
            </div>
          </a>
        </div>
      </div>
    </ZoonkWeb.SettingsLayout.render>
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

  defp get_social_icon("Bluesky"), do: "tabler-brand-bluesky"
  defp get_social_icon("Facebook"), do: "tabler-brand-facebook"
  defp get_social_icon("Instagram"), do: "tabler-brand-instagram"
  defp get_social_icon("LinkedIn"), do: "tabler-brand-linkedin"
  defp get_social_icon("Reddit"), do: "tabler-brand-reddit"
  defp get_social_icon("Threads"), do: "tabler-brand-threads"
  defp get_social_icon("TikTok"), do: "tabler-brand-tiktok"
  defp get_social_icon("X"), do: "tabler-brand-x"
  defp get_social_icon("YouTube"), do: "tabler-brand-youtube"
  defp get_social_icon(_other), do: "tabler-link"
end
