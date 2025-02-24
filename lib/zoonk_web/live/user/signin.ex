defmodule ZoonkWeb.Live.UserSignIn do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Auth

  def render(assigns) do
    ~H"""
    <div class="mx-auto max-w-sm">
      <.header class="text-center">
        <p>{dgettext("users", "Log in")}</p>
        <:subtitle>
          <%= if @current_user do %>
            {dgettext(
              "users",
              "You need to reauthenticate to perform sensitive actions on your account."
            )}
          <% else %>
            {dgettext("users", "Don't have an account?")}
            <.link
              navigate={~p"/signup"}
              class="text-brand font-semibold hover:underline"
              phx-no-format
            >
              {dgettext("users", "Sign up")}
            </.link>
            {dgettext("users", "for an account now.")}
          <% end %>
        </:subtitle>
      </.header>

      <.link href={~p"/auth/google"}>
        {dgettext("users", "Log in with Google")}
      </.link>

      <.link href={~p"/auth/github"}>
        {dgettext("users", "Log in with GitHub")}
      </.link>

      <.link href={~p"/auth/apple"}>
        {dgettext("users", "Log in with Apple")}
      </.link>

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
        &url(~p"/login/#{&1}")
      )
    end

    info =
      dgettext("users", "If your email is in our system, you will receive instructions for logging in shortly.")

    {:noreply,
     socket
     |> put_flash(:info, info)
     |> push_navigate(to: ~p"/login")}
  end
end
