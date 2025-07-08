defmodule ZoonkWeb.LanguageLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Accounts
  alias Zoonk.Localization

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.AppLayout.render flash={@flash} scope={@scope}>
      <.form_container
        for={@language_form}
        id="language_form"
        phx-submit="submit"
        phx-change="validate_language"
      >
        <:title>{dgettext("settings", "Change language")}</:title>

        <:subtitle>
          {dgettext(
            "settings",
            "Choose the language for the app interface."
          )}
        </:subtitle>

        <.input
          id="user-language"
          field={@language_form[:language]}
          label={dgettext("settings", "Language")}
          type="select"
          options={Localization.list_languages(:options)}
          required
          hide_label
        />

        <:requirements>
          {dgettext("settings", "This changes the language for the entire app.")}
        </:requirements>
      </.form_container>
    </ZoonkWeb.AppLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    user = socket.assigns.scope.user
    language_changeset = Accounts.change_user_settings(user, %{})

    socket =
      socket
      |> assign(:current_language, user.language)
      |> assign(:language_form, to_form(language_changeset))
      |> assign(:page_title, dgettext("page_title", "App language"))

    {:ok, socket}
  end

  @impl Phoenix.LiveView
  def handle_event("validate_language", params, socket) do
    %{"user" => user_params} = params

    language_form =
      socket.assigns.scope.user
      |> Accounts.change_user_settings(user_params)
      |> Map.put(:action, :validate)
      |> to_form()

    socket = assign(socket, :language_form, language_form)

    {:noreply, socket}
  end

  def handle_event("submit", params, socket) do
    %{"user" => user_params} = params
    user = socket.assigns.scope.user

    case Accounts.update_user_settings(user, user_params) do
      {:ok, _updated_user} ->
        {:noreply, push_navigate(socket, to: ~p"/language")}

      {:error, changeset} ->
        {:noreply, assign(socket, :language_form, to_form(changeset, action: :insert))}
    end
  end
end
