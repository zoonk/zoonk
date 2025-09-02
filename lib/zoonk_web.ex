defmodule ZoonkWeb do
  @moduledoc """
  The entrypoint for defining your web interface, such
  as controllers, components, channels, and so on.

  This can be used in your application as:

      use ZoonkWeb, :controller
      use ZoonkWeb, :html

  The definitions below will be executed for every controller,
  component, etc, so keep them short and clean, focused
  on imports, uses and aliases.

  Do NOT define functions inside the quoted expressions
  below. Instead, define additional modules and import
  those modules here.
  """

  def static_paths, do: ~w(assets fonts images error favicon.ico robots.txt)

  def router do
    quote do
      use Phoenix.Router, helpers: false

      # Import common connection and controller functions to use in pipelines
      import Phoenix.Controller
      import Phoenix.LiveView.Router
      import Plug.Conn
    end
  end

  def channel do
    quote do
      use Phoenix.Channel
    end
  end

  def controller do
    quote do
      use Phoenix.Controller, formats: [:html, :json]
      use Gettext, backend: Zoonk.Gettext

      import Plug.Conn

      unquote(verified_routes())
    end
  end

  def live_view do
    quote do
      use Phoenix.LiveView

      unquote(html_helpers())
    end
  end

  def live_component do
    quote do
      use Phoenix.LiveComponent

      unquote(html_helpers())
    end
  end

  def html do
    quote do
      use Phoenix.Component

      # Import convenience functions from controllers
      import Phoenix.Controller,
        only: [get_csrf_token: 0, view_module: 1, view_template: 1]

      # Include general helpers for rendering HTML
      unquote(html_helpers())
    end
  end

  defp html_helpers do
    quote do
      # Translation
      use Gettext, backend: Zoonk.Gettext

      # HTML escaping functionality
      import Phoenix.HTML

      # Core UI components
      import ZoonkWeb.Components.Accordion
      import ZoonkWeb.Components.Anchor
      import ZoonkWeb.Components.AsyncPage
      import ZoonkWeb.Components.Avatar
      import ZoonkWeb.Components.Button
      import ZoonkWeb.Components.Card
      import ZoonkWeb.Components.Command
      import ZoonkWeb.Components.Dialog
      import ZoonkWeb.Components.Divider
      import ZoonkWeb.Components.Dropdown
      import ZoonkWeb.Components.FAQ
      import ZoonkWeb.Components.Flash
      import ZoonkWeb.Components.Form
      import ZoonkWeb.Components.Icon
      import ZoonkWeb.Components.InfoCard
      import ZoonkWeb.Components.Input
      import ZoonkWeb.Components.Loader
      import ZoonkWeb.Components.Navbar
      import ZoonkWeb.Components.Pill
      import ZoonkWeb.Components.Stepper
      import ZoonkWeb.Components.Text
      import ZoonkWeb.Components.Toggle
      import ZoonkWeb.Components.Utils

      # Config
      import ZoonkWeb.MenuIcon

      # Shortcut for generating JS commands
      alias Phoenix.LiveView.JS

      # Routes generation with the ~p sigil
      unquote(verified_routes())
    end
  end

  def verified_routes do
    quote do
      use Phoenix.VerifiedRoutes,
        endpoint: ZoonkWeb.Endpoint,
        router: ZoonkWeb.Router,
        statics: ZoonkWeb.static_paths()

      use Gettext, backend: Zoonk.Gettext
    end
  end

  @doc """
  When used, dispatch to the appropriate controller/live_view/etc.
  """
  defmacro __using__(which) when is_atom(which) do
    apply(__MODULE__, which, [])
  end
end
