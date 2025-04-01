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
        :if={!@link_sent}
        for={@form}
        id="login_form_magic"
        action={~p"/login"}
        phx-submit="submit_magic"
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

        <.button type="submit" class="w-full" icon_align={:left} icon="tabler-mail-filled">
          {dgettext("users", "Login")}
        </.button>
      </.form>

      <.card :if={@link_sent} size={:auto}>
        <.card_content class="flex flex-col gap-4">
          <.text>
            {dgettext("users", "If your email is in our system, you will receive a link to login.")}
          </.text>

          <.button phx-click="try_again" variant={:outline} class="w-full">
            {dgettext("users", "Try again")}
          </.button>
        </.card_content>
      </.card>
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
      |> assign(link_sent: false)
      |> assign(page_title: dgettext("users", "Sign in with email"))

    {:ok, socket}
  end

  def handle_event("submit_magic", %{"email" => email}, socket) do
    if user = Accounts.get_user_by_email(email) do
      Accounts.deliver_login_instructions(
        user,
        &url(socket.assigns.uri, ~p"/login/t/#{&1}")
      )
    end

    {:noreply, assign(socket, link_sent: true)}
  end

  def handle_event("try_again", _params, socket) do
    {:noreply, assign(socket, link_sent: false)}
  end
end
