defmodule ZoonkWeb.UserLive.SignIn do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Auth

  def render(assigns) do
    ~H"""
    <div class="mx-auto max-w-sm">
      <.header class="text-center">
        <p>Log in</p>
        <:subtitle>
          <%= if @current_user do %>
            You need to reauthenticate to perform sensitive actions on your account.
          <% else %>
            Don't have an account? <.link
              navigate={~p"/users/signup"}
              class="text-brand font-semibold hover:underline"
              phx-no-format
            >Sign up</.link> for an account now.
          <% end %>
        </:subtitle>
      </.header>

      <.simple_form
        :let={f}
        for={@form}
        id="signin_form_magic"
        action={~p"/users/signin"}
        phx-submit="submit_magic"
      >
        <.input
          readonly={!!@current_user}
          field={f[:email]}
          type="email"
          label="Email"
          autocomplete="username"
          required
        />
        <.button class="w-full">
          Log in with email <span aria-hidden="true">→</span>
        </.button>
      </.simple_form>
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
        &url(~p"/users/signin/#{&1}")
      )
    end

    info =
      "If your email is in our system, you will receive instructions for logging in shortly."

    {:noreply,
     socket
     |> put_flash(:info, info)
     |> push_navigate(to: ~p"/users/signin")}
  end
end
