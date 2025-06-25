defmodule ZoonkWeb.NameLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Accounts

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.AppLayout.render flash={@flash} scope={@scope}>
      <section class="flex flex-1 flex-col md:items-center md:justify-center lg:mx-auto lg:max-w-3xl">
        <.form_container
          for={@name_form}
          id="name_form"
          phx-submit="submit"
          phx-change="validate_name"
        >
          <:title>{dgettext("settings", "Change Display Name")}</:title>

          <:subtitle>
            {dgettext(
              "settings",
              "This is the name we use when calling you on the UI (e.g. on personalized exercises). This information is not public."
            )}
          </:subtitle>

          <.input
            id="user-display-name"
            field={@name_form[:display_name]}
            label={dgettext("settings", "Display name")}
            type="text"
            autocomplete="name"
            hide_label
          />

          <:requirements>
            {dgettext("settings", "You can change your display name at any time.")}
          </:requirements>
        </.form_container>
      </section>
    </ZoonkWeb.AppLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    user = socket.assigns.scope.user
    user_profile = Zoonk.Repo.preload(user, :profile).profile
    name_changeset = Accounts.change_user_display_name(user_profile, %{})

    socket =
      socket
      |> assign(:current_display_name, user_profile.display_name)
      |> assign(:name_form, to_form(name_changeset))
      |> assign(:trigger_submit, false)
      |> assign(:page_title, dgettext("page_title", "Display name"))

    {:ok, socket}
  end

  @impl Phoenix.LiveView
  def handle_event("validate_name", params, socket) do
    %{"user_profile" => profile_params} = params
    user = socket.assigns.scope.user
    user_profile = Zoonk.Repo.preload(user, :profile).profile

    name_form =
      user_profile
      |> Accounts.change_user_display_name(profile_params)
      |> Map.put(:action, :validate)
      |> to_form()

    {:noreply, assign(socket, name_form: name_form)}
  end

  def handle_event("submit", params, socket) do
    %{"user_profile" => profile_params} = params
    user = socket.assigns.scope.user
    user_profile = Zoonk.Repo.preload(user, :profile).profile

    case Accounts.update_user_profile(user_profile, profile_params) do
      {:ok, _updated_profile} ->
        socket =
          socket
          |> put_flash(:info, dgettext("settings", "Display name updated successfully."))
          |> push_navigate(to: ~p"/name")

        {:noreply, socket}

      {:error, changeset} ->
        {:noreply, assign(socket, :name_form, to_form(changeset, action: :insert))}
    end
  end
end
