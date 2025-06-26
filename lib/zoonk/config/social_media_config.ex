defmodule Zoonk.Config.SocialMediaConfig do
  @moduledoc """
  Manages social media link configurations for the application.

  This module centralizes all social media links used throughout
  the application, ensuring consistency and ease of maintenance.
  """

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

  @doc """
  Returns social media links for a given region.

  ## Parameters
    - region: `:global` or `:brazil`

  ## Example
      iex> get_links(:global)
      [%{name: "Bluesky", url: "https://bsky.app/profile/zoonk.bsky.social", ...}, ...]

      iex> get_links(:brazil)
      [%{name: "Bluesky", url: "https://bsky.app/profile/zoonkbr.bsky.social", ...}, ...]
  """
  def get_links(:global), do: @social_media_links.global
  def get_links(:brazil), do: @social_media_links.brazil

  @doc """
  Returns social media links based on language preference.

  Returns Brazil links for Portuguese ("pt"), global links for all others.

  ## Example
      iex> get_links_for_language("pt")
      [%{name: "Bluesky", url: "https://bsky.app/profile/zoonkbr.bsky.social", ...}, ...]

      iex> get_links_for_language("en")
      [%{name: "Bluesky", url: "https://bsky.app/profile/zoonk.bsky.social", ...}, ...]
  """
  def get_links_for_language("pt"), do: get_links(:brazil)
  def get_links_for_language(_), do: get_links(:global)
end