defmodule ZoonkWeb.Live.UserLoginWithEmail do
  @moduledoc false
  use ZoonkWeb, :live_view

  import ZoonkWeb.Components.User

  alias Zoonk.Accounts

  def render(assigns) do
    ~H"""
    <.main_container action={:login} show_options>
      <.simple_form
        :let={f}
        for={@form}
        id="login_form_magic"
        action={~p"/login"}
        phx-submit="submit_magic"
        class="flex w-full flex-col gap-4"
        label={dgettext("users", "Sign in form")}
      >
        <.input
          readonly={!!@current_scope}
          field={f[:email]}
          label={dgettext("users", "Email address")}
          hide_label
          type="email"
          placeholder={dgettext("users", "Email")}
          autocomplete="username"
          required
        />

        <.button type="submit" full icon="tabler-mail-filled">
          {dgettext("users", "Login")}
        </.button>
      </.simple_form>
    </.main_container>
    """
  end

  def mount(_params, _session, socket) do
    email =
      Phoenix.Flash.get(socket.assigns.flash, :email) ||
        get_in(socket.assigns, [:current_scope, Access.key(:user), Access.key(:email)])

    form = to_form(%{"email" => email})

    socket =
      socket
      |> assign(form: form)
      |> assign(trigger_submit: false)
      |> assign(page_title: dgettext("users", "Sign in with email"))

    {:ok, socket}
  end

  def handle_event("submit_magic", %{"email" => email}, socket) do
    if user = Accounts.get_user_by_email(email) do
      Accounts.deliver_login_instructions(
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
