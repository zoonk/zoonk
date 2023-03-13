defmodule ZoonkWeb.UserConfirmationInstructionsLive do
  use ZoonkWeb, :live_view

  alias Zoonk.Accounts

  def render(assigns) do
    ~H"""
    <.header><%= dgettext("auth", "Resend confirmation instructions") %></.header>

    <.simple_form for={@form} id="resend_confirmation_form" phx-submit="send_instructions">
      <.input field={@form[:email]} type="email" label={dgettext("auth", "Email")} required />

      <:actions>
        <.button phx-disable-with={gettext("Sending...")}>
          <%= dgettext("auth", "Resend confirmation instructions") %>
        </.button>
      </:actions>
    </.simple_form>

    <p>
      <.link href={~p"/users/register"}><%= dgettext("auth", "Register") %></.link>
      |
      <.link href={~p"/users/log_in"}><%= dgettext("auth", "Log in") %></.link>
    </p>
    """
  end

  def mount(_params, _session, socket) do
    {:ok, assign(socket, form: to_form(%{}, as: "user"))}
  end

  def handle_event("send_instructions", %{"user" => %{"email" => email}}, socket) do
    if user = Accounts.get_user_by_email(email) do
      Accounts.deliver_user_confirmation_instructions(
        user,
        &url(~p"/users/confirm/#{&1}")
      )
    end

    info =
      dgettext(
        "auth",
        "If your email is in our system and it has not been confirmed yet, you will receive an email with instructions shortly."
      )

    {:noreply,
     socket
     |> put_flash(:info, info)
     |> redirect(to: ~p"/")}
  end
end
