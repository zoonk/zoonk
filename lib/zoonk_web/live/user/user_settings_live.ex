defmodule ZoonkWeb.UserSettingsLive do
  use ZoonkWeb, :live_view

  alias Phoenix.LiveView.Diff
  alias Zoonk.Accounts

  def render(assigns) do
    ~H"""
    <nav class="flex justify-end mb-8">
      <.link_styled href={~p"/users/log_out"} method="delete" class="text-sm">
        <%= dgettext("auth", "Log out") %>
      </.link_styled>
    </nav>

    <section class="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
      <.simple_form
        for={@settings_form}
        id="settings_form"
        phx-submit="update_settings"
        phx-change="validate_settings"
        title={dgettext("auth", "Change Settings")}
      >
        <.input
          field={@settings_form[:username]}
          type="text"
          label={dgettext("auth", "Username")}
          autocomplete="username"
          required
          value={@current_username}
        />

        <.input
          field={@settings_form[:language]}
          type="select"
          label={dgettext("auth", "Language")}
          options={Zoonk.Language.language_options()}
          value={@current_language}
          required
        />

        <:actions>
          <.button phx-disable-with={gettext("Changing...")}>
            <%= dgettext("auth", "Change Settings") %>
          </.button>
        </:actions>
      </.simple_form>

      <.simple_form
        for={@email_form}
        id="email_form"
        phx-submit="update_email"
        phx-change="validate_email"
        title={dgettext("auth", "Change Email")}
      >
        <.input field={@email_form[:email]} type="email" label="Email" required />

        <.input
          field={@email_form[:current_password]}
          name="current_password"
          id="current_password_for_email"
          type="password"
          label={dgettext("auth", "Current password")}
          value={@email_form_current_password}
          required
        />
        <:actions>
          <.button phx-disable-with={gettext("Changing...")}>
            <%= dgettext("auth", "Change Email") %>
          </.button>
        </:actions>
      </.simple_form>

      <.simple_form
        for={@password_form}
        id="password_form"
        action={~p"/users/log_in?_action=password_updated"}
        method="post"
        phx-change="validate_password"
        phx-submit="update_password"
        phx-trigger-action={@trigger_submit}
        title={dgettext("auth", "Change Password")}
      >
        <.input
          field={@password_form[:email]}
          id="current_email_for_password"
          type="hidden"
          value={@current_email}
        />

        <.input
          field={@password_form[:current_password]}
          name="current_password"
          type="password"
          label={dgettext("auth", "Current password")}
          id="current_password_for_password"
          value={@current_password}
          required
        />

        <.input
          field={@password_form[:password]}
          type="password"
          label={dgettext("auth", "New password")}
          autocomplete="new-password"
          required
        />

        <.input
          field={@password_form[:password_confirmation]}
          type="password"
          label={dgettext("auth", "Confirm new password")}
          autocomplete="new-password"
        />

        <:actions>
          <.button phx-disable-with={gettext("Changing...")}>
            <%= dgettext("auth", "Change Password") %>
          </.button>
        </:actions>
      </.simple_form>
    </section>
    """
  end

  def mount(%{"token" => token}, _session, socket) do
    socket =
      case Accounts.update_user_email(socket.assigns.current_user, token) do
        :ok ->
          put_flash(socket, :info, dgettext("auth", "Email changed successfully."))

        :error ->
          put_flash(
            socket,
            :error,
            dgettext("auth", "Email change link is invalid or it has expired.")
          )
      end

    {:ok, push_navigate(socket, to: ~p"/users/settings")}
  end

  def mount(_params, _session, socket) do
    user = socket.assigns.current_user
    settings_changeset = Accounts.change_user_settings(user)
    email_changeset = Accounts.change_user_email(user)
    password_changeset = Accounts.change_user_password(user)

    socket =
      socket
      |> assign(:page_title, dgettext("auth", "Settings"))
      |> assign(:current_language, user.language)
      |> assign(:current_username, user.username)
      |> assign(:current_password, nil)
      |> assign(:email_form_current_password, nil)
      |> assign(:current_email, user.email)
      |> assign(:settings_form, to_form(settings_changeset))
      |> assign(:email_form, to_form(email_changeset))
      |> assign(:password_form, to_form(password_changeset))
      |> assign(:trigger_submit, false)

    {:ok, socket}
  end

  def handle_event("validate_settings", params, socket) do
    %{"user" => user_params} = params

    settings_form =
      socket.assigns.current_user
      |> Accounts.change_user_settings(user_params)
      |> Map.put(:action, :validate)
      |> to_form()

    {:noreply, assign(socket, settings_form: settings_form)}
  end

  def handle_event("update_settings", params, socket) do
    %{"user" => user_params} = params
    user = socket.assigns.current_user

    case Accounts.update_user_settings(user, user_params) do
      {:ok, user} ->
        settings_form = user |> Accounts.change_user_settings(user_params) |> to_form()

        Gettext.put_locale(ZoonkWeb.Gettext, user_params["language"])

        socket =
          socket
          |> put_flash(:info, dgettext("auth", "Settings updated successfully"))
          |> assign(
            settings_form: settings_form,
            current_username: user_params["username"],
            current_language: user_params["language"]
          )

        socket = %{socket | fingerprints: Diff.new_fingerprints()}

        {:noreply, socket}

      {:error, changeset} ->
        socket =
          socket
          |> put_flash(:error, dgettext("auth", "Error updating settings"))
          |> assign(settings_form: to_form(changeset))

        {:noreply, socket}
    end
  end

  def handle_event("validate_email", params, socket) do
    %{"current_password" => password, "user" => user_params} = params

    email_form =
      socket.assigns.current_user
      |> Accounts.change_user_email(user_params)
      |> Map.put(:action, :validate)
      |> to_form()

    {:noreply, assign(socket, email_form: email_form, email_form_current_password: password)}
  end

  def handle_event("update_email", params, socket) do
    %{"current_password" => password, "user" => user_params} = params
    user = socket.assigns.current_user

    case Accounts.apply_user_email(user, password, user_params) do
      {:ok, applied_user} ->
        Accounts.deliver_user_update_email_instructions(
          applied_user,
          user.email,
          &url(~p"/users/settings/confirm_email/#{&1}")
        )

        info =
          dgettext(
            "auth",
            "A link to confirm your email change has been sent to the new address."
          )

        {:noreply, socket |> put_flash(:info, info) |> assign(email_form_current_password: nil)}

      {:error, changeset} ->
        {:noreply, assign(socket, :email_form, to_form(Map.put(changeset, :action, :insert)))}
    end
  end

  def handle_event("validate_password", params, socket) do
    %{"current_password" => password, "user" => user_params} = params

    password_form =
      socket.assigns.current_user
      |> Accounts.change_user_password(user_params)
      |> Map.put(:action, :validate)
      |> to_form()

    {:noreply, assign(socket, password_form: password_form, current_password: password)}
  end

  def handle_event("update_password", params, socket) do
    %{"current_password" => password, "user" => user_params} = params
    user = socket.assigns.current_user

    case Accounts.update_user_password(user, password, user_params) do
      {:ok, user} ->
        password_form =
          user
          |> Accounts.change_user_password(user_params)
          |> to_form()

        {:noreply, assign(socket, trigger_submit: true, password_form: password_form)}

      {:error, changeset} ->
        {:noreply, assign(socket, password_form: to_form(changeset))}
    end
  end
end
