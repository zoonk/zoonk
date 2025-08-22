defmodule ZoonkWeb.CommandPaletteConfig do
  @moduledoc """
  Configuration for command palette navigation items.

  Centralizes all static menu items for the command palette component,
  including navigation links, user account actions, settings, and support options.
  """
  use ZoonkWeb, :html

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
        icon: menu_icon(:home),
        label: dgettext("menu", "Home page"),
        navigate: ~p"/"
      },
      %{
        icon: menu_icon(:catalog),
        label: dgettext("menu", "Catalog"),
        navigate: ~p"/catalog"
      },
      %{
        icon: menu_icon(:new_course),
        label: dgettext("menu", "Start new course"),
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
        icon: menu_icon(:my_courses),
        label: dgettext("menu", "My courses"),
        navigate: ~p"/my-courses"
      },
      %{
        icon: menu_icon(:subscription),
        label: dgettext("menu", "Subscription"),
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
        icon: menu_icon(:language),
        label: dgettext("menu", "Change app language"),
        navigate: ~p"/language"
      },
      %{
        icon: menu_icon(:display_name),
        label: dgettext("menu", "Change display name"),
        navigate: ~p"/name"
      },
      %{
        icon: menu_icon(:email),
        label: dgettext("menu", "Change email address"),
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
        icon: menu_icon(:feedback),
        label: dgettext("menu", "Send feedback"),
        navigate: ~p"/feedback",
        visibility: :always
      },
      %{
        icon: menu_icon(:support),
        label: dgettext("menu", "Support"),
        navigate: ~p"/support",
        visibility: :always
      },
      %{
        icon: menu_icon(:follow_us),
        label: dgettext("menu", "Follow us on social media"),
        navigate: ~p"/follow",
        visibility: :always
      },
      %{
        icon: menu_icon(:logout),
        label: dgettext("menu", "Logout"),
        href: ~p"/logout",
        method: "delete",
        visibility: :authenticated
      },
      %{
        icon: menu_icon(:login),
        label: dgettext("menu", "Login"),
        navigate: ~p"/login",
        visibility: :unauthenticated
      },
      %{
        icon: menu_icon(:signup),
        label: dgettext("menu", "Sign up"),
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
