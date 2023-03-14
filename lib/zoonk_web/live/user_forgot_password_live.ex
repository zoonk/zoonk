defmodule ZoonkWeb.UserForgotPasswordLive do
  use ZoonkWeb, :live_view

  alias Zoonk.Accounts

  def render(assigns) do
    ~H"""
    <div class="mx-auto max-w-sm">
      <.header class="text-center">
        <%= dgettext("auth", "Forgot your password?") %>

        <:subtitle>
          <%= dgettext("auth", "We'll send a password reset link to your inbox") %>
        </:subtitle>
      </.header>

      <.simple_form for={@form} id="reset_password_form" phx-submit="send_email">
        <.input field={@form[:email]} type="email" placeholder={dgettext("auth", "Email")} required />

        <:actions>
          <.button phx-disable-with={gettext("Sending...")} class="w-full">
            <%= dgettext("auth", "Send password reset instructions") %>
          </.button>
        </:actions>
      </.simple_form>

      <p class="text-center mt-4">
        <.link href={~p"/users/register"}><%= dgettext("auth", "Register") %></.link>
        |
        <.link href={~p"/users/log_in"}><%= dgettext("auth", "Log in") %></.link>
      </p>
    </div>
    """
  end

  def mount(_params, _session, socket) do
    socket =
      socket
      |> assign(:page_title, dgettext("auth", "Forgot your password?"))
      |> assign(form: to_form(%{}, as: "user"))

    {:ok, socket}
  end

  def handle_event("send_email", %{"user" => %{"email" => email}}, socket) do
    if user = Accounts.get_user_by_email(email) do
      Accounts.deliver_user_reset_password_instructions(
        user,
        &url(~p"/users/reset_password/#{&1}")
      )
    end

    info =
      dgettext(
        "auth",
        "If your email is in our system, you will receive instructions to reset your password shortly."
      )

    {:noreply,
     socket
     |> put_flash(:info, info)
     |> redirect(to: ~p"/")}
  end
end
