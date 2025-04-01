defmodule ZoonkWeb.Onboarding.OnboardingPermissions do
  @moduledoc false
  use ZoonkWeb, :verified_routes

  alias Zoonk.Orgs.Org
  alias Zoonk.Scope

  def on_mount(:onboarding_permissions, _params, _session, socket) do
    handle_permissions(socket, socket.assigns.scope)
  end

  defp handle_permissions(socket, %Scope{org: %Org{kind: :app}, user: nil}), do: {:cont, socket}
  defp handle_permissions(socket, _scope), do: {:halt, Phoenix.LiveView.redirect(socket, to: ~p"/")}
end
