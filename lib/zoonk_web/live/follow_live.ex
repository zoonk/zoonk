defmodule ZoonkWeb.FollowLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Config.SocialMediaConfig

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
    language = session["language"]
    social_links = SocialMediaConfig.get_links_for_language(language)
    
    socket = 
      socket
      |> assign(:page_title, dgettext("page_title", "Follow us"))
      |> assign(:social_links, social_links)
    
    {:ok, socket}
  end
end
