defmodule ZoonkWeb.User.UserSignUpLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  import ZoonkWeb.User.UserComponents

  alias Zoonk.Accounts.User
  alias Zoonk.Analytics
  alias Zoonk.Config.AuthConfig
  alias Zoonk.Scope
  alias ZoonkWeb.UserAuth

  def render(assigns) do
    ~H"""
    <.main_container action={:signup} flash={@flash}>
      <section
        aria-label={dgettext("users", "Use one of the external providers below:")}
        class="flex w-full flex-col gap-2"
      >
        <.auth_link :for={provider <- AuthConfig.list_providers()} provider={provider} />
      </section>

      <section aria-label={dgettext("users", "Or use your email address")} class="w-full">
        <.divider label={dgettext("users", "or")} background={:bg} />
        <.auth_link provider={:email} action={:signup} />
      </section>
    </.main_container>
    """
  end

  def mount(_params, _session, %{assigns: %{scope: %Scope{user: %User{}}}} = socket) do
    {:ok, redirect(socket, to: UserAuth.signed_in_path(socket))}
  end

  def mount(_params, session, socket) do
    Analytics.capture("signup_started", session["guest_user_id"])

    {:ok, assign(socket, page_title: dgettext("users", "Create an account"))}
  end
end
