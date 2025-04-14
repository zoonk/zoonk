defmodule ZoonkWeb.Onboarding.OnboardingPermissions do
  @moduledoc false
  use ZoonkWeb, :verified_routes

  alias Zoonk.Accounts.User
  alias Zoonk.Catalog
  alias Zoonk.Orgs.Org
  alias Zoonk.Scope

  def on_mount(:onboarding_permissions, _params, _session, socket) do
    handle_permissions(socket, socket.assigns.scope)
  end

  defp handle_permissions(socket, %Scope{org: %Org{kind: :app}, user: nil}), do: {:cont, socket}

  # only guest users who are not enrolled in any courses can access the onboarding page
  defp handle_permissions(socket, %Scope{org: %Org{kind: :app}, user: %User{id: user_id, kind: :guest}}) do
    if Catalog.user_enrolled_in_any_course?(user_id) do
      {:halt, Phoenix.LiveView.redirect(socket, to: ~p"/")}
    else
      {:cont, socket}
    end
  end

  defp handle_permissions(socket, _scope) do
    {:halt, Phoenix.LiveView.redirect(socket, to: ~p"/")}
  end
end
