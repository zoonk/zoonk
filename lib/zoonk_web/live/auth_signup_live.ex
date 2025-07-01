defmodule ZoonkWeb.AuthSignUpLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  import ZoonkWeb.AuthComponents

  alias Zoonk.Accounts
  alias Zoonk.Accounts.User
  alias Zoonk.Scope
  alias ZoonkWeb.UserAuth

  def render(assigns) do
    ~H"""
    <.main_container action={:signup} flash={@flash}>
      <section
        aria-label={dgettext("auth", "Use one of the external providers below:")}
        class="flex w-full flex-col gap-2"
      >
        <.auth_link :for={provider <- Accounts.list_providers()} provider={provider} />
      </section>

      <section aria-label={dgettext("auth", "Or use your email address")} class="w-full">
        <.divider label={dgettext("auth", "or")} background={:bg} />
        <.auth_link provider={:email} action={:signup} />
      </section>
    </.main_container>
    """
  end

  def mount(_params, _session, %{assigns: %{scope: %Scope{user: %User{}}}} = socket) do
    {:ok, redirect(socket, to: UserAuth.signed_in_path(socket))}
  end

  def mount(_params, _session, socket) do
    {:ok, assign(socket, page_title: dgettext("page_title", "Create an account"))}
  end
end
