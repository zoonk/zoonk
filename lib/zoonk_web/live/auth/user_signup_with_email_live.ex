defmodule ZoonkWeb.User.UserSignUpWithEmailLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  import ZoonkWeb.User.UserComponents

  alias Zoonk.Accounts
  alias Zoonk.Accounts.User
  alias Zoonk.Analytics
  alias Zoonk.Config.LanguageConfig
  alias Zoonk.Scope
  alias ZoonkWeb.UserAuth

  def render(assigns) do
    ~H"""
    <.main_container action={:signup} show_options flash={@flash}>
      <.form
        for={@form}
        id="signup_form"
        phx-submit="save"
        phx-change="validate"
        aria-label={dgettext("users", "Signup form")}
        class="flex w-full flex-col gap-4"
      >
        <.error :if={@check_errors}>
          {dgettext("users", "Oops, something went wrong! Please check the errors below.")}
        </.error>

        <.input
          field={@form[:language]}
          type="select"
          label={dgettext("users", "Language")}
          options={LanguageConfig.list_languages(:options)}
          required
          class="w-full"
        />

        <.input
          field={@form[:email]}
          type="email"
          label={dgettext("users", "Email address")}
          autocomplete="username"
          placeholder={dgettext("users", "myemail@gmail.com")}
          required
          class="w-full"
        />

        <.button
          type="submit"
          phx-disable-with={dgettext("users", "Creating account...")}
          icon="tabler-user-plus"
          icon_align={:left}
          size={:md}
          class="w-full"
        >
          {dgettext("users", "Create an account")}
        </.button>
      </.form>
    </.main_container>
    """
  end

  def mount(_params, _session, %{assigns: %{scope: %Scope{user: %User{}}}} = socket) do
    {:ok, redirect(socket, to: UserAuth.signed_in_path(socket))}
  end

  def mount(_params, session, socket) do
    language = Map.get(session, "language")
    changeset = Accounts.change_user_email(%User{language: language})

    Analytics.capture("signup_with_email_started", socket.assigns.scope, %{language: language})

    socket =
      socket
      |> assign(check_errors: false)
      |> assign_form(changeset)
      |> assign(page_title: dgettext("users", "Create an account"))

    {:ok, socket, temporary_assigns: [form: nil]}
  end

  def handle_event("save", %{"user" => user_params}, socket) do
    case Accounts.signup_user(user_params, socket.assigns.scope) do
      {:ok, user} ->
        {:ok, _url_fn} = Accounts.deliver_login_instructions(user)

        {:noreply, push_navigate(socket, to: ~p"/confirm/signup?email=#{user.email}")}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply,
         socket
         |> assign(check_errors: true)
         |> assign_form(changeset)}
    end
  end

  def handle_event("validate", %{"user" => user_params}, socket) do
    changeset = Accounts.change_user_email(%User{}, user_params)
    {:noreply, assign_form(socket, Map.put(changeset, :action, :validate))}
  end

  defp assign_form(socket, %Ecto.Changeset{} = changeset) do
    form = to_form(changeset, as: "user")

    if changeset.valid? do
      assign(socket, form: form, check_errors: false)
    else
      assign(socket, form: form)
    end
  end
end
