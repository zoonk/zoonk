defmodule ZoonkWeb.Live.UserConfirmation do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Auth

  def render(assigns) do
    ~H"""
    <div class="h-[calc(100dvh-70px)] mx-auto flex max-w-sm flex-col items-center justify-center px-8 text-center">
      <.simple_form
        :if={!@user.confirmed_at}
        for={@form}
        id="confirmation_form"
        phx-submit="submit"
        action={~p"/login?_action=confirmed"}
        phx-trigger-action={@trigger_submit}
      >
        <input type="hidden" name={@form[:token].name} value={@form[:token].value} />

        <.button type="submit" phx-disable-with={dgettext("users", "Confirming...")} class="w-full">
          {dgettext("users", "Confirm my account")}
        </.button>
      </.simple_form>

      <.simple_form
        :if={@user.confirmed_at}
        for={@form}
        id="signin_form"
        phx-submit="submit"
        action={~p"/login"}
        phx-trigger-action={@trigger_submit}
      >
        <input type="hidden" name={@form[:token].name} value={@form[:token].value} />

        <.button type="submit" phx-disable-with={dgettext("users", "Logging in...")} class="w-full">
          {dgettext("users", "Log in")}
        </.button>
      </.simple_form>
    </div>
    """
  end

  def mount(%{"token" => token}, _session, socket) do
    if user = Auth.get_user_by_magic_link_token(token) do
      form = to_form(%{"token" => token}, as: "user")

      {:ok, assign(socket, user: user, form: form, trigger_submit: false), temporary_assigns: [form: nil]}
    else
      {:ok,
       socket
       |> put_flash(:error, dgettext("users", "Magic link is invalid or it has expired."))
       |> push_navigate(to: ~p"/login/email")}
    end
  end

  def handle_event("submit", %{"user" => params}, socket) do
    {:noreply, assign(socket, form: to_form(params, as: "user"), trigger_submit: true)}
  end
end
