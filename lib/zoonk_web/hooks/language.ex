defmodule ZoonkWeb.Hooks.Language do
  @moduledoc """
  LiveView hooks for setting the application language.
  """
  alias Zoonk.Schemas.User
  alias Zoonk.Scope

  @doc """
  Sets the application language.

  It works based on the user's preference or the session language,
  which is set by `ZoonkWeb.Plugs.Language`.

  ## `on_mount` arguments

    * `:set_app_language` - Sets the application language
      based on the user's preference or the session language.

  ## Examples
  Use the `live_session` of your router to invoke the on_mount callback:

      alias ZoonkWeb.Hooks

      live_session :my_liveview,
        on_mount: [{Hooks.Language, :set_app_language}] do
        # my code here
      end
  """
  def on_mount(:set_app_language, _params, session, socket) do
    user_language = get_user_language(socket.assigns.current_scope, session)
    Gettext.put_locale(Zoonk.Gettext, user_language)
    {:cont, socket}
  end

  defp get_user_language(nil, session), do: Map.get(session, "language")
  defp get_user_language(%Scope{user: %User{language: language}}, _session), do: Atom.to_string(language)
end
