defmodule ZoonkWeb.Live.UserSignUp do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Auth
  alias Zoonk.Schemas.User
  alias ZoonkWeb.Helpers

  def render(assigns) do
    ~H"""
    <div class="mx-auto max-w-sm">
      <.simple_form for={@form} id="registration_form" phx-submit="save" phx-change="validate">
        <.error :if={@check_errors}>
          {dgettext("users", "Oops, something went wrong! Please check the errors below.")}
        </.error>

        <.input
          field={@form[:language]}
          type="select"
          label={dgettext("users", "Language")}
          options={Zoonk.Configuration.language_select_options()}
          required
        />
        <.input
          field={@form[:email]}
          type="email"
          label={dgettext("users", "Email")}
          autocomplete="username"
          required
        />

        <:actions>
          <.button phx-disable-with={dgettext("users", "Creating account...")} class="w-full">
            {dgettext("users", "Create an account")}
          </.button>
        </:actions>
      </.simple_form>
    </div>
    """
  end

  def mount(_params, _session, %{assigns: %{current_user: %User{}}} = socket) do
    {:ok, redirect(socket, to: Helpers.UserAuth.signed_in_path(socket))}
  end

  def mount(_params, session, socket) do
    language = Map.get(session, "language")
    changeset = Auth.change_user_email(%User{language: language})

    socket =
      socket
      |> assign(check_errors: false)
      |> assign_form(changeset)

    {:ok, socket, temporary_assigns: [form: nil]}
  end

  def handle_event("save", %{"user" => user_params}, socket) do
    case Auth.register_user(user_params) do
      {:ok, user} ->
        {:ok, _url_fn} =
          Auth.deliver_signin_instructions(
            user,
            &url(~p"/login/#{&1}")
          )

        {:noreply,
         socket
         |> put_flash(
           :info,
           dgettext("users", "An email was sent to %{email}, please access it to confirm your account.",
             email: user.email
           )
         )
         |> push_navigate(to: ~p"/login")}

      {:error, %Ecto.Changeset{} = changeset} ->
        {:noreply,
         socket
         |> assign(check_errors: true)
         |> assign_form(changeset)}
    end
  end

  def handle_event("validate", %{"user" => user_params}, socket) do
    changeset = Auth.change_user_email(%User{}, user_params)
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
