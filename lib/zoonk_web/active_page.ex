defmodule ZoonkWeb.ActivePage do
  @moduledoc """
  LiveView hook that sets the current active page.

  This can be used to highlight the current page in a navigation menu.
  """
  import Phoenix.Component
  import Phoenix.LiveView

  @doc """
  Attaches the `:active_page` hook to the LiveView socket.

  ## Usage

  We're attaching this hook to all LiveViews in the `ZoonkWeb`
  module. This means it's available anytime you call
  `use ZoonkWeb, :live_view`.

  Then, you can use the `@active_page` variable in your templates
  to determine which page is currently active.
  """
  def on_mount(:default, _params, _session, socket) do
    {:cont, attach_hook(socket, :active_page, :handle_params, &set_active_page/3)}
  end

  # Get the view's name and convert it to an atom that can be used on the menu to check if the current view is active.
  defp set_active_page(_params, _url, socket) do
    active_page =
      case socket.view do
        view when is_atom(view) ->
          view
          |> Module.split()
          |> List.last()
          |> Zoonk.Helpers.to_snake_case()

        _invalid ->
          nil
      end

    {:cont, assign(socket, active_page: maybe_add_live_action(socket, active_page))}
  end

  # Add the live_action as the suffix to the active_page when it exists.
  defp maybe_add_live_action(%{assigns: %{live_action: live_action}}, active_page) do
    if live_action, do: convert_to_atom("#{active_page}_#{live_action}"), else: convert_to_atom(active_page)
  end

  # We don't need the active_page for some views.
  # This means there won't be an existing atom.
  # This function just ignores errors from the atom conversion.
  defp convert_to_atom(view) do
    String.to_existing_atom(view)
  rescue
    ArgumentError -> nil
  end
end
