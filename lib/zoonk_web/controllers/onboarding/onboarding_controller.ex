defmodule ZoonkWeb.Onboarding.OnboardingController do
  @moduledoc """
  Controller that handles onboarding form submissions.

  This controller is responsible for creating guest users and starting
  the onboarding process based on the user's input.
  """
  use ZoonkWeb, :controller

  alias Zoonk.Accounts

  def create(conn, %{"language" => language, "query" => query}) do
    if conn.assigns.scope.user do
      redirect(conn, to: ~p"/start/#{query}")
    else
      case Accounts.create_guest_user(%{language: language}, conn.assigns.scope) do
        {:ok, user} ->
          conn
          |> put_session(:user_return_to, ~p"/start/#{query}")
          |> ZoonkWeb.UserAuth.login_user(user)

        {:error, _changeset} ->
          conn
          |> put_flash(:error, dgettext("onboarding", "Failed to create guest account. Please try again."))
          |> redirect(to: ~p"/start")
      end
    end
  end
end
