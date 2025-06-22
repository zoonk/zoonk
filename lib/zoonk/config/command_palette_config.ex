defmodule Zoonk.Config.CommandPaletteConfig do
  @moduledoc """
  Configuration for command palette navigation items.

  Centralizes all static menu items for the command palette component,
  including navigation links, user account actions, settings, and support options.
  """
  use ZoonkWeb, :verified_routes

  alias Zoonk.Config.MenuIconsConfig

  @doc """
  Returns the navigation items for the command palette.

  ## Examples

      navigation_items()
      # => [
      #   %{icon: "tabler-home", label: "Home page", navigate: "/"},
      #   ...
      # ]
  """
  def navigation_items do
    [
      %{
        icon: MenuIconsConfig.get_icon(:home),
        label: gettext("Home page"),
        navigate: ~p"/"
      },
      %{
        icon: MenuIconsConfig.get_icon(:catalog),
        label: gettext("Catalog"),
        navigate: ~p"/catalog"
      },
      %{
        icon: MenuIconsConfig.get_icon(:start_course),
        label: gettext("Start new course"),
        navigate: ~p"/learn"
      }
    ]
  end

  @doc """
  Returns the user account items for the command palette.

  ## Examples

      user_items()
      # => [
      #   %{icon: "tabler-layout-grid", label: "My courses", navigate: "/my-courses"},
      #   ...
      # ]
  """
  def user_items do
    [
      %{
        icon: MenuIconsConfig.get_icon(:my_courses),
        label: dgettext("users", "My courses"),
        navigate: ~p"/my-courses"
      },
      %{
        icon: MenuIconsConfig.get_icon(:missions),
        label: dgettext("users", "Missions"),
        navigate: ~p"/missions"
      },
      %{
        icon: MenuIconsConfig.get_icon(:purchases),
        label: dgettext("users", "Purchases"),
        navigate: ~p"/purchases"
      },
      %{
        icon: MenuIconsConfig.get_icon(:subscription),
        label: dgettext("users", "Subscription"),
        navigate: ~p"/subscription"
      }
    ]
  end

  @doc """
  Returns the settings items for the command palette.

  ## Examples

      settings_items()
      # => [
      #   %{icon: "tabler-language", label: "Change app language", navigate: "/language"},
      #   ...
      # ]
  """
  def settings_items do
    [
      %{
        icon: MenuIconsConfig.get_icon(:language),
        label: gettext("Change app language"),
        navigate: ~p"/language"
      },
      %{
        icon: MenuIconsConfig.get_icon(:display_name),
        label: gettext("Change display name"),
        navigate: ~p"/name"
      },
      %{
        icon: MenuIconsConfig.get_icon(:email),
        label: gettext("Change email address"),
        navigate: ~p"/email"
      }
    ]
  end

  @doc """
  Returns the support items for the command palette.

  ## Examples

      support_items()
      # => [
      #   %{icon: "tabler-message-circle", label: "Send feedback", navigate: "/feedback"},
      #   ...
      # ]
  """
  def support_items do
    [
      %{
        icon: MenuIconsConfig.get_icon(:feedback),
        label: dgettext("users", "Send feedback"),
        navigate: ~p"/feedback"
      },
      %{
        icon: MenuIconsConfig.get_icon(:support),
        label: dgettext("users", "Support"),
        navigate: ~p"/support"
      },
      %{
        icon: MenuIconsConfig.get_icon(:follow),
        label: gettext("Follow us on social media"),
        navigate: ~p"/follow"
      },
      %{
        icon: MenuIconsConfig.get_icon(:logout),
        label: dgettext("users", "Logout"),
        href: ~p"/logout",
        method: "delete"
      }
    ]
  end

  @doc """
  Returns all command palette items as a flat list for search operations.

  ## Examples

      all_items()
      # => [%{icon: "tabler-home", label: "Home page", navigate: "/"}, ...]
  """
  def all_items do
    navigation_items() ++ user_items() ++ settings_items() ++ support_items()
  end
end
