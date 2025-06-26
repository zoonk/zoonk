defmodule Zoonk.Config.SocialConfig do
  @moduledoc """
  Manages social media link configurations for the application.

  This module centralizes all social media links used throughout
  the application, ensuring consistency and ease of maintenance.
  """

  @doc """
  Returns social media links based on the locale.

  For Portuguese (pt), returns Brazil-specific links.
  For all other locales, returns global links.

  ## Examples

      iex> get_social_links("pt")
      [%{name: "Facebook", url: "https://www.facebook.com/zoonkbr", ...}, ...]

      iex> get_social_links("en")
      [%{name: "Facebook", url: "https://www.facebook.com/zoonkcom", ...}, ...]
  """
  def get_social_links("pt") do
    [
      %{
        name: "Bluesky",
        url: "https://bsky.app/profile/zoonkbr.bsky.social",
        icon: "tabler-brand-bluesky",
        handle: "@zoonkbr"
      },
      %{name: "Facebook", url: "https://www.facebook.com/zoonkbr", icon: "tabler-brand-facebook", handle: "@zoonkbr"},
      %{name: "Instagram", url: "https://www.instagram.com/zoonkbr", icon: "tabler-brand-instagram", handle: "@zoonkbr"},
      %{name: "LinkedIn", url: "https://www.linkedin.com/company/zoonk", icon: "tabler-brand-linkedin", handle: "@zoonk"},
      %{
        name: "Reddit",
        url: "https://www.reddit.com/r/ZoonkBrasil",
        icon: "tabler-brand-reddit",
        handle: "r/ZoonkBrasil"
      },
      %{name: "Threads", url: "https://www.threads.net/@zoonkbr", icon: "tabler-brand-threads", handle: "@zoonkbr"},
      %{name: "TikTok", url: "https://www.tiktok.com/@zoonkbr", icon: "tabler-brand-tiktok", handle: "@zoonkbr"},
      %{name: "X", url: "https://x.com/zoonkbr", icon: "tabler-brand-x", handle: "@zoonkbr"},
      %{name: "YouTube", url: "https://www.youtube.com/@zoonkbr", icon: "tabler-brand-youtube", handle: "@zoonkbr"}
    ]
  end

  def get_social_links(_locale) do
    [
      %{
        name: "Bluesky",
        url: "https://bsky.app/profile/zoonk.bsky.social",
        icon: "tabler-brand-bluesky",
        handle: "@zoonk"
      },
      %{name: "Facebook", url: "https://www.facebook.com/zoonkcom", icon: "tabler-brand-facebook", handle: "@zoonkcom"},
      %{
        name: "Instagram",
        url: "https://www.instagram.com/zoonkcom",
        icon: "tabler-brand-instagram",
        handle: "@zoonkcom"
      },
      %{name: "LinkedIn", url: "https://www.linkedin.com/company/zoonk", icon: "tabler-brand-linkedin", handle: "@zoonk"},
      %{name: "Reddit", url: "https://www.reddit.com/r/zoonk", icon: "tabler-brand-reddit", handle: "r/zoonk"},
      %{name: "Threads", url: "https://www.threads.net/@zoonkcom", icon: "tabler-brand-threads", handle: "@zoonkcom"},
      %{name: "TikTok", url: "https://www.tiktok.com/@zoonkcom", icon: "tabler-brand-tiktok", handle: "@zoonkcom"},
      %{name: "X", url: "https://x.com/zoonkcom", icon: "tabler-brand-x", handle: "@zoonkcom"},
      %{name: "YouTube", url: "https://www.youtube.com/@zoonkcom", icon: "tabler-brand-youtube", handle: "@zoonkcom"}
    ]
  end
end
