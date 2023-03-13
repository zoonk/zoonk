defmodule ZoonkWeb.UserLoginLive do
  use ZoonkWeb, :live_view

  def render(assigns) do
    ~H"""
    <div class="mx-auto max-w-sm">
      <.header class="text-center">
        <%= dgettext("auth", "Sign in to account") %>

        <:subtitle>
          <%= dgettext("auth", "Don't have an account?") %>

          <.link navigate={~p"/users/register"} class="font-semibold text-primary hover:underline">
            <%= dgettext("auth", "Sign up") %>
          </.link>
          <%= dgettext("auth", "for an account now.") %>
        </:subtitle>
      </.header>

      <.simple_form for={@form} id="login_form" action={~p"/users/log_in"} phx-update="ignore">
        <.input
          field={@form[:email_or_username]}
          type="text"
          label={dgettext("auth", "Email or username")}
          autocomplete="username"
          required
        />

        <.input
          field={@form[:password]}
          type="password"
          label={dgettext("auth", "Password")}
          required
        />

        <:actions>
          <.input
            field={@form[:remember_me]}
            type="checkbox"
            label={dgettext("auth", "Keep me logged in")}
          />

          <.link href={~p"/users/reset_password"} class="text-sm font-semibold">
            <%= dgettext("auth", "Forgot your password?") %>
          </.link>
        </:actions>

        <:actions>
          <.button phx-disable-with={dgettext("auth", "Signing in...")} class="w-full">
            <%= dgettext("auth", "Sign in") %> <span aria-hidden="true">→</span>
          </.button>
        </:actions>
      </.simple_form>
    </div>
    """
  end

  def mount(_params, _session, socket) do
    email_or_username = live_flash(socket.assigns.flash, :email_or_username)
    form = to_form(%{"email_or_username" => email_or_username}, as: "user")
    {:ok, assign(socket, form: form), temporary_assigns: [form: form]}
  end
end
