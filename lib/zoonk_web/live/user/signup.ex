defmodule ZoonkWeb.Live.UserSignUp do
  @moduledoc false
  use ZoonkWeb, :live_view

  import ZoonkWeb.Components.User

  alias Zoonk.Schemas.UserIdentity
  alias Zoonk.Scope
  alias ZoonkWeb.Helpers

  def render(assigns) do
    ~H"""
    <.main_container action={:signup}>
      <section
        class="flex w-full flex-col gap-2"
        aria-label={dgettext("users", "Use one of the external accounts below:")}
      >
        <.auth_link :for={identity <- [:apple, :google, :github]} provider={identity} />
      </section>

      <section class="w-full" aria-label={dgettext("users", "Or use your email address")}>
        <.divider label={dgettext("users", "or")} class="my-4" />
        <.auth_link provider={:email} action={:signup} />
      </section>
    </.main_container>
    """
  end

  def mount(_params, _session, %{assigns: %{current_scope: %Scope{user_identity: %UserIdentity{}}}} = socket) do
    {:ok, redirect(socket, to: Helpers.UserAuth.signed_in_path(socket))}
  end

  def mount(_params, _session, socket) do
    {:ok, assign(socket, page_title: dgettext("users", "Create an account"))}
  end
end
