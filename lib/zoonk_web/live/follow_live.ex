defmodule ZoonkWeb.FollowLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Accounts.User
  alias Zoonk.Scope

  # Social media links - Global and Brazil versions
  @social_media_links %{
    global: [
      %{name: "Bluesky", url: "https://bsky.app/profile/zoonk.bsky.social", icon: "tabler-brand-bluesky", handle: "@zoonk"},
      %{name: "Facebook", url: "https://www.facebook.com/zoonkcom", icon: "tabler-brand-facebook", handle: "@zoonkcom"},
      %{name: "Instagram", url: "https://www.instagram.com/zoonkcom", icon: "tabler-brand-instagram", handle: "@zoonkcom"},
      %{name: "LinkedIn", url: "https://www.linkedin.com/company/zoonk", icon: "tabler-brand-linkedin", handle: "@zoonk"},
      %{name: "Reddit", url: "https://www.reddit.com/r/zoonk", icon: "tabler-brand-reddit", handle: "r/zoonk"},
      %{name: "Threads", url: "https://www.threads.net/@zoonkcom", icon: "tabler-brand-threads", handle: "@zoonkcom"},
      %{name: "TikTok", url: "https://www.tiktok.com/@zoonkcom", icon: "tabler-brand-tiktok", handle: "@zoonkcom"},
      %{name: "X", url: "https://x.com/zoonkcom", icon: "tabler-brand-x", handle: "@zoonkcom"},
      %{name: "YouTube", url: "https://www.youtube.com/@zoonkcom", icon: "tabler-brand-youtube", handle: "@zoonkcom"}
    ],
    brazil: [
      %{name: "Bluesky", url: "https://bsky.app/profile/zoonkbr.bsky.social", icon: "tabler-brand-bluesky", handle: "@zoonkbr"},
      %{name: "Facebook", url: "https://www.facebook.com/zoonkbr", icon: "tabler-brand-facebook", handle: "@zoonkbr"},
      %{name: "Instagram", url: "https://www.instagram.com/zoonkbr", icon: "tabler-brand-instagram", handle: "@zoonkbr"},
      %{name: "LinkedIn", url: "https://www.linkedin.com/company/zoonk", icon: "tabler-brand-linkedin", handle: "@zoonk"},
      %{name: "Reddit", url: "https://www.reddit.com/r/ZoonkBrasil", icon: "tabler-brand-reddit", handle: "r/ZoonkBrasil"},
      %{name: "Threads", url: "https://www.threads.net/@zoonkbr", icon: "tabler-brand-threads", handle: "@zoonkbr"},
      %{name: "TikTok", url: "https://www.tiktok.com/@zoonkbr", icon: "tabler-brand-tiktok", handle: "@zoonkbr"},
      %{name: "X", url: "https://x.com/zoonkbr", icon: "tabler-brand-x", handle: "@zoonkbr"},
      %{name: "YouTube", url: "https://www.youtube.com/@zoonkbr", icon: "tabler-brand-youtube", handle: "@zoonkbr"}
    ]
  }

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.AppLayout.render flash={@flash} scope={@scope}>
      <div class="max-w-2xl mx-auto">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold mb-4">
            {dgettext("page_title", "Follow us")}
          </h1>
          <p class="text-gray-600">
            {dgettext("default", "Stay connected with us on social media for the latest updates and news.")}
          </p>
        </div>
        
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div :for={social <- @social_links} class="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <.a 
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center space-x-3 text-gray-900 no-underline hover:no-underline w-full"
            >
              <.icon name={social.icon} size={:md} class="text-gray-700" />
              <div>
                <div class="font-medium">{social.name}</div>
                <div class="text-sm text-gray-500">{social.handle}</div>
              </div>
            </.a>
          </div>
        </div>
      </div>
    </ZoonkWeb.AppLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, session, socket) do
    user_language = get_user_language(socket.assigns.scope, session)
    social_links = if user_language == "pt", do: @social_media_links.brazil, else: @social_media_links.global
    
    socket = 
      socket
      |> assign(:page_title, dgettext("page_title", "Follow us"))
      |> assign(:social_links, social_links)
    
    {:ok, socket}
  end

  defp get_user_language(%Scope{user: %User{language: language}}, _session), do: Atom.to_string(language)
  defp get_user_language(_scope, session), do: Map.get(session, "language")
end
