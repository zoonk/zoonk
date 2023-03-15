defmodule ZoonkWeb.UserLoginLive do
  use ZoonkWeb, :live_view

  import ZoonkWeb.Components.User

  def render(assigns) do
    ~H"""
    <.auth_container>
      <.auth_header>
        <%= dgettext("auth", "Sign in to account") %>
        <:description>
          <%= dgettext("auth", "Don't have an account?") %>
          <.link_styled navigate={~p"/users/register"}>
            <%= dgettext("auth", "Sign up") %>
          </.link_styled>
        </:description>
      </.auth_header>

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

          <.link_styled navigate={~p"/users/reset_password"} color={:black} class="text-sm">
            <%= dgettext("auth", "Forgot your password?") %>
          </.link_styled>
        </:actions>

        <:actions>
          <.button phx-disable-with={dgettext("auth", "Signing in...")} class="w-full">
            <%= dgettext("auth", "Sign in") %> <span aria-hidden="true">→</span>
          </.button>
        </:actions>
      </.simple_form>
    </.auth_container>
    """
  end

  def mount(_params, _session, socket) do
    email_or_username = live_flash(socket.assigns.flash, :email_or_username)
    form = to_form(%{"email_or_username" => email_or_username}, as: "user")

    socket = socket |> assign(:page_title, dgettext("auth", "Sign in")) |> assign(form: form)

    {:ok, socket, temporary_assigns: [form: form]}
  end
end
