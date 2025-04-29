defmodule ZoonkWeb.User.UserLoginWithEmailLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  import ZoonkWeb.User.UserComponents

  alias Zoonk.Accounts

  def render(assigns) do
    ~H"""
    <.main_container action={:login} flash={@flash} show_options>
      <.form
        :let={f}
        for={@form}
        id="login_form"
        action={~p"/login"}
        phx-submit="submit"
        aria-label={dgettext("users", "Sign in form")}
        class="flex w-full flex-col gap-4"
      >
        <.input
          field={f[:email]}
          label={dgettext("users", "Email address")}
          hide_label
          type="email"
          placeholder={dgettext("users", "Email")}
          autocomplete="username"
          required
          class="w-full"
        />

        <.button type="submit" class="w-full" size={:md} icon_align={:left} icon="tabler-mail-filled">
          {dgettext("users", "Login")}
        </.button>
      </.form>
    </.main_container>
    """
  end

  def mount(_params, _session, socket) do
    email =
      Phoenix.Flash.get(socket.assigns.flash, :email) ||
        get_in(socket.assigns, [:scope, Access.key(:user), Access.key(:email)])

    form = to_form(%{"email" => email})

    socket =
      socket
      |> assign(form: form)
      |> assign(page_title: dgettext("users", "Sign in with email"))

    {:ok, socket}
  end

  def handle_event("submit", %{"email" => email}, socket) do
    if user = Accounts.get_user_by_email(email) do
      Accounts.deliver_login_instructions(user)
    end

    {:noreply, push_navigate(socket, to: ~p"/login/code")}
  end
end
