defmodule Zoonk.Support.Social do
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
        handle: "@zoonkbr"
      },
      %{name: "Facebook", url: "https://www.facebook.com/zoonkbr", handle: "@zoonkbr"},
      %{name: "Instagram", url: "https://www.instagram.com/zoonkbr", handle: "@zoonkbr"},
      %{name: "LinkedIn", url: "https://www.linkedin.com/company/zoonk", handle: "@zoonk"},
      %{
        name: "Reddit",
        url: "https://www.reddit.com/r/ZoonkBrasil",
        handle: "r/ZoonkBrasil"
      },
      %{name: "Threads", url: "https://www.threads.net/@zoonkbr", handle: "@zoonkbr"},
      %{name: "TikTok", url: "https://www.tiktok.com/@zoonkbr", handle: "@zoonkbr"},
      %{name: "X", url: "https://x.com/zoonkbr", handle: "@zoonkbr"},
      %{name: "YouTube", url: "https://www.youtube.com/@zoonkbr", handle: "@zoonkbr"}
    ]
  end

  def get_social_links(_locale) do
    [
      %{
        name: "Bluesky",
        url: "https://bsky.app/profile/zoonk.bsky.social",
        handle: "@zoonk"
      },
      %{name: "Facebook", url: "https://www.facebook.com/zoonkcom", handle: "@zoonkcom"},
      %{
        name: "Instagram",
        url: "https://www.instagram.com/zoonkcom",
        handle: "@zoonkcom"
      },
      %{name: "LinkedIn", url: "https://www.linkedin.com/company/zoonk", handle: "@zoonk"},
      %{name: "Reddit", url: "https://www.reddit.com/r/zoonk", handle: "r/zoonk"},
      %{name: "Threads", url: "https://www.threads.net/@zoonkcom", handle: "@zoonkcom"},
      %{name: "TikTok", url: "https://www.tiktok.com/@zoonkcom", handle: "@zoonkcom"},
      %{name: "X", url: "https://x.com/zoonkcom", handle: "@zoonkcom"},
      %{name: "YouTube", url: "https://www.youtube.com/@zoonkcom", handle: "@zoonkcom"}
    ]
  end
end
