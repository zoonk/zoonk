defmodule ZoonkWeb.UserLive.Login do
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
              navigate={~p"/users/register"}
              class="font-semibold text-brand hover:underline"
              phx-no-format
            >Sign up</.link> for an account now.
          <% end %>
        </:subtitle>
      </.header>

      <.simple_form
        :let={f}
        for={@form}
        id="login_form_magic"
        action={~p"/users/log-in"}
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

      <div class="flex items-center mt-8 -mb-6 text-sm">
        <hr class="flex-grow border-t-2 border-gray-300" />
        <span class="mx-2 text-gray-500">or</span>
        <hr class="flex-grow border-t-2 border-gray-300" />
      </div>

      <.simple_form
        :let={f}
        for={@form}
        id="login_form_password"
        action={~p"/users/log-in"}
        phx-submit="submit_password"
        phx-trigger-action={@trigger_submit}
      >
        <.input
          readonly={!!@current_user}
          field={f[:email]}
          type="email"
          label="Email"
          autocomplete="username"
          required
        />
        <.input
          field={@form[:password]}
          type="password"
          label="Password"
          autocomplete="current-password"
        />
        <.input
          :if={!@current_user}
          field={f[:remember_me]}
          type="checkbox"
          label="Keep me logged in"
        />
        <.button class="w-full">
          Log in <span aria-hidden="true">→</span>
        </.button>
      </.simple_form>

      <div :if={local_mail_adapter?()} class="mt-8 p-4 border text-center">
        <p>You are running the local mail adapter.</p>
        <p>
          To see sent emails, visit <.link href="/dev/mailbox" class="underline">the mailbox page</.link>.
        </p>
      </div>
    </div>
    """
  end

  def mount(_params, _session, socket) do
    email =
      Phoenix.Flash.get(socket.assigns.flash, :email) ||
        get_in(socket.assigns, [:current_user, Access.key(:email)])

    form = to_form(%{"email" => email}, as: "user")

    {:ok, assign(socket, form: form, trigger_submit: false)}
  end

  def handle_event("submit_password", _params, socket) do
    {:noreply, assign(socket, :trigger_submit, true)}
  end

  def handle_event("submit_magic", %{"user" => %{"email" => email}}, socket) do
    if user = Auth.get_user_by_email(email) do
      Auth.deliver_login_instructions(
        user,
        &url(~p"/users/log-in/#{&1}")
      )
    end

    info =
      "If your email is in our system, you will receive instructions for logging in shortly."

    {:noreply,
     socket
     |> put_flash(:info, info)
     |> push_navigate(to: ~p"/users/log-in")}
  end

  defp local_mail_adapter? do
    Application.get_env(:zoonk, Zoonk.Mailer)[:adapter] == Swoosh.Adapters.Local
  end
end
