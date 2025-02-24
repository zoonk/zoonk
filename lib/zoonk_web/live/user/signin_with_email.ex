defmodule ZoonkWeb.Live.UserSignInWithEmail do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Auth

  def render(assigns) do
    ~H"""
    <div class="mx-auto max-w-sm">
      <%= if @current_user do %>
        {dgettext(
          "users",
          "You need to reauthenticate to perform sensitive actions on your account."
        )}
      <% end %>
      <.simple_form
        :let={f}
        for={@form}
        id="signin_form_magic"
        action={~p"/login"}
        phx-submit="submit_magic"
      >
        <.input
          readonly={!!@current_user}
          field={f[:email]}
          type="email"
          label={dgettext("users", "Email")}
          autocomplete="username"
          required
        />
        <.button class="w-full">
          {dgettext("users", "Log in with email →")}
        </.button>
      </.simple_form>

      <.link navigate={~p"/signup"} class="mt-4 text-sm">
        {dgettext("users", "Sign up")}
      </.link>
    </div>
    """
  end

  def mount(_params, _session, socket) do
    email =
      Phoenix.Flash.get(socket.assigns.flash, :email) ||
        get_in(socket.assigns, [:current_user, Access.key(:email)])

    form = to_form(%{"email" => email})

    {:ok, assign(socket, form: form, trigger_submit: false)}
  end

  def handle_event("submit_magic", %{"email" => email}, socket) do
    if user = Auth.get_user_by_email(email) do
      Auth.deliver_signin_instructions(
        user,
        &url(~p"/login/t/#{&1}")
      )
    end

    info =
      dgettext("users", "If your email is in our system, you will receive instructions for logging in shortly.")

    {:noreply,
     socket
     |> put_flash(:info, info)
     |> push_navigate(to: ~p"/login/email")}
  end
end
