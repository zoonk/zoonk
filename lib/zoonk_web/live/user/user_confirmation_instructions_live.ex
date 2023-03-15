defmodule ZoonkWeb.UserConfirmationInstructionsLive do
  use ZoonkWeb, :live_view

  import ZoonkWeb.Components.User

  alias Zoonk.Accounts

  def render(assigns) do
    ~H"""
    <.auth_container>
      <.simple_form
        for={@form}
        id="resend_confirmation_form"
        title={dgettext("auth", "Resend confirmation instructions")}
        phx-submit="send_instructions"
      >
        <.input field={@form[:email]} type="email" label={dgettext("auth", "Email")} required />

        <:actions>
          <.button phx-disable-with={gettext("Sending...")} class="w-full">
            <%= dgettext("auth", "Resend confirmation instructions") %>
          </.button>
        </:actions>
      </.simple_form>

      <.auth_links />
    </.auth_container>
    """
  end

  def mount(_params, _session, socket) do
    socket =
      socket
      |> assign(:page_title, dgettext("auth", "Resend confirmation instructions"))
      |> assign(form: to_form(%{}, as: "user"))

    {:ok, socket}
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
