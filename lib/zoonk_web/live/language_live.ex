defmodule ZoonkWeb.LanguageLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Accounts
  alias Zoonk.Config.LanguageConfig

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.AppLayout.render flash={@flash} scope={@scope}>
      <section class="flex flex-1 flex-col md:items-center md:justify-center lg:mx-auto lg:max-w-3xl">
        <.form_container
          for={@language_form}
          id="language_form"
          phx-submit="submit"
          phx-change="validate_language"
        >
          <:title>{dgettext("settings", "Language")}</:title>

          <:subtitle>
            {dgettext("settings", "Select your preferred language for the app.")}
          </:subtitle>

          <.input
            id="user-language"
            field={@language_form[:language]}
            label={dgettext("settings", "Language")}
            type="select"
            options={@language_options}
            required
            hide_label
          />

          <:requirements>
            {dgettext("settings", "This language will be used for the app interface.")}
          </:requirements>
        </.form_container>
      </section>
    </ZoonkWeb.AppLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    user = socket.assigns.scope.user
    language_changeset = Accounts.change_user_language(user, %{})

    socket =
      socket
      |> assign(:current_language, user.language)
      |> assign(:language_form, to_form(language_changeset))
      |> assign(:language_options, LanguageConfig.list_languages(:options))
      |> assign(:trigger_submit, false)
      |> assign(:page_title, dgettext("page_title", "App language"))

    {:ok, socket}
  end

  @impl Phoenix.LiveView
  def handle_event("validate_language", params, socket) do
    %{"user" => user_params} = params

    language_form =
      socket.assigns.scope.user
      |> Accounts.change_user_language(user_params)
      |> Map.put(:action, :validate)
      |> to_form()

    {:noreply, assign(socket, language_form: language_form)}
  end

  def handle_event("submit", params, socket) do
    %{"user" => user_params} = params
    user = socket.assigns.scope.user

    case Accounts.update_user_language(user, user_params) do
      {:ok, _user} ->
        {:noreply, 
         socket
         |> put_flash(:info, dgettext("settings", "Language updated successfully."))
         |> push_navigate(to: ~p"/language")}

      {:error, changeset} ->
        {:noreply, assign(socket, :language_form, to_form(changeset, action: :insert))}
    end
  end
end
