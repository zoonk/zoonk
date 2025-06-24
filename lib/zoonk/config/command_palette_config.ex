defmodule Zoonk.Config.CommandPaletteConfig do
  @moduledoc """
  Configuration for command palette navigation items.

  Centralizes all static menu items for the command palette component,
  including navigation links, user account actions, settings, and support options.
  """
  use ZoonkWeb, :verified_routes

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
        icon: "tabler-home",
        label: gettext("Home page"),
        navigate: ~p"/"
      },
      %{
        icon: "tabler-layout-grid",
        label: gettext("Catalog"),
        navigate: ~p"/catalog"
      },
      %{
        icon: "tabler-circle-plus",
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
        icon: "tabler-layout-grid",
        label: dgettext("users", "My courses"),
        navigate: ~p"/my-courses"
      },
      %{
        icon: "tabler-target",
        label: dgettext("users", "Missions"),
        navigate: ~p"/missions"
      },
      %{
        icon: "tabler-package",
        label: dgettext("users", "Purchases"),
        navigate: ~p"/purchases"
      },
      %{
        icon: "tabler-diamond",
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
        icon: "tabler-language",
        label: gettext("Change app language"),
        navigate: ~p"/language"
      },
      %{
        icon: "tabler-id-badge",
        label: gettext("Change display name"),
        navigate: ~p"/name"
      },
      %{
        icon: "tabler-mail",
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
        icon: "tabler-message-circle",
        label: dgettext("users", "Send feedback"),
        navigate: ~p"/feedback",
        visibility: :always
      },
      %{
        icon: "tabler-lifebuoy",
        label: dgettext("users", "Support"),
        navigate: ~p"/support",
        visibility: :always
      },
      %{
        icon: "tabler-ufo",
        label: gettext("Follow us on social media"),
        navigate: ~p"/follow",
        visibility: :always
      },
      %{
        icon: "tabler-logout",
        label: dgettext("users", "Logout"),
        href: ~p"/logout",
        method: "delete",
        visibility: :authenticated
      },
      %{
        icon: "tabler-user",
        label: dgettext("users", "Login"),
        navigate: ~p"/login",
        visibility: :unauthenticated
      },
      %{
        icon: "tabler-user-plus",
        label: dgettext("users", "Sign up"),
        navigate: ~p"/signup",
        visibility: :unauthenticated
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
