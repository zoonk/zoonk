defmodule ZoonkWeb.Live.UserSignUp do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Schemas.User
  alias ZoonkWeb.Helpers

  def render(assigns) do
    ~H"""
    <div class="mx-auto max-w-sm">sign up placeholder</div>
    """
  end

  def mount(_params, _session, %{assigns: %{current_user: %User{}}} = socket) do
    {:ok, redirect(socket, to: Helpers.UserAuth.signed_in_path(socket))}
  end

  def mount(_params, _session, socket) do
    {:ok, socket}
  end
end
