defmodule ZoonkWeb.Live.UserSignInWithEmail do
  @moduledoc false
  use ZoonkWeb, :live_view

  import ZoonkWeb.Components.User

  alias Zoonk.Auth

  def render(assigns) do
    ~H"""
    <main
      aria-labelledby="signin-title"
      class="h-dvh mx-auto flex max-w-sm flex-col items-center justify-center px-8 text-center"
    >
      <.text id="signin-title" element={:h1} size={:title} class="w-full pb-4">
        {dgettext("users", "What's your email address?")}
      </.text>

      <.simple_form
        :let={f}
        for={@form}
        id="signin_form_magic"
        action={~p"/login"}
        phx-submit="submit_magic"
        label={dgettext("users", "Sign in form")}
      >
        <.input
          readonly={!!@current_user}
          field={f[:email]}
          type="email"
          placeholder={dgettext("users", "Email")}
          autocomplete="username"
          required
        />

        <.button full icon="tabler-mail-filled">
          {dgettext("users", "Log in with email")}
        </.button>
      </.simple_form>

      <.a navigate={~p"/login"} class="mt-4 text-sm">
        ← {dgettext("users", "Other login options")}
      </.a>

      <.signup_link />
    </main>
    """
  end

  def mount(_params, _session, socket) do
    email =
      Phoenix.Flash.get(socket.assigns.flash, :email) ||
        get_in(socket.assigns, [:current_user, Access.key(:email)])

    form = to_form(%{"email" => email})

    socket =
      socket
      |> assign(form: form)
      |> assign(trigger_submit: false)
      |> display_flash_for_logged_in_user()

    {:ok, socket}
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

  defp display_flash_for_logged_in_user(socket) when is_nil(socket.assigns.current_user), do: socket

  defp display_flash_for_logged_in_user(socket) do
    put_flash(
      socket,
      :error,
      dgettext("users", "You need to reauthenticate to perform sensitive actions on your account.")
    )
  end
end
