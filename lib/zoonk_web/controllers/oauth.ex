defmodule ZoonkWeb.Controllers.OAuth do
  @moduledoc """
  Handles OAuth authentication via Ueberauth.
  """
  use ZoonkWeb, :controller

  alias Zoonk.Auth.Providers
  alias Zoonk.Schemas.User

  plug Ueberauth

  def callback(%{assigns: %{ueberauth_failure: %Ueberauth.Failure{}}} = conn, _params) do
    conn
    |> put_flash(:error, dgettext("users", "Failed to authenticate"))
    |> redirect(to: ~p"/users/signin")
  end

  def callback(%{assigns: %{ueberauth_auth: %Ueberauth.Auth{} = auth}} = conn, _params) do
    language = get_session(conn, :language)

    case Providers.signin_with_provider(auth, language) do
      {:ok, %User{} = user} ->
        ZoonkWeb.Helpers.UserAuth.signin_user(conn, user)

      {:error, _changeset} ->
        conn
        |> put_flash(:error, dgettext("users", "Failed to authenticate"))
        |> redirect(to: ~p"/users/signin")
    end
  end
end
