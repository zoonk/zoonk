defmodule ZoonkWeb.AuthLoginWithEmailLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  import ZoonkWeb.AuthComponents

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
        aria-label={dgettext("auth", "Sign in form")}
        class="flex w-full flex-col gap-4"
      >
        <.input
          field={f[:email]}
          label={dgettext("auth", "Email address")}
          hide_label
          type="email"
          placeholder={dgettext("auth", "Email")}
          autocomplete="username"
          required
          class="w-full"
        />

        <.button type="submit" class="w-full" size={:md} icon_align={:left} icon="tabler-mail-filled">
          {dgettext("auth", "Login")}
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
      |> assign(page_title: dgettext("page_title", "Sign in with email"))

    {:ok, socket}
  end

  def handle_event("submit", %{"email" => email}, socket) do
    if user = Accounts.get_user_by_email(email) do
      Accounts.deliver_login_instructions(user)
    end

    {:noreply, push_navigate(socket, to: ~p"/confirm/login?email=#{email}")}
  end
end
