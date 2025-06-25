defmodule ZoonkWeb.NameLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Accounts

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.AppLayout.render flash={@flash} scope={@scope}>
      <.form_layout>
        <.form_container
          for={@name_form}
          id="name_form"
          phx-submit="submit"
          phx-change="validate_name"
          display_success={@display_success?}
        >
          <:title>{dgettext("settings", "Update your name")}</:title>

          <:subtitle>
            {dgettext(
              "settings",
              "This is the name we use when calling you in the app."
            )}
          </:subtitle>

          <.input
            id="user-display-name"
            field={@name_form[:display_name]}
            label={dgettext("settings", "Name")}
            type="text"
            placeholder={dgettext("settings", "Enter your name")}
            hide_label
          />

          <:requirements>
            {dgettext("settings", "This is not visible to others.")}
          </:requirements>
        </.form_container>
      </.form_layout>
    </ZoonkWeb.AppLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    user_profile = socket.assigns.scope.user.profile
    name_changeset = Accounts.change_user_profile(user_profile, %{})

    socket =
      socket
      |> assign(:current_display_name, user_profile.display_name)
      |> assign(:name_form, to_form(name_changeset))
      |> assign(:display_success?, false)
      |> assign(:page_title, dgettext("page_title", "Update your name"))

    {:ok, socket}
  end

  @impl Phoenix.LiveView
  def handle_event("validate_name", params, socket) do
    %{"user_profile" => profile_params} = params

    name_form =
      socket.assigns.scope.user.profile
      |> Accounts.change_user_profile(profile_params)
      |> Map.put(:action, :validate)
      |> to_form()

    socket =
      socket
      |> assign(:name_form, name_form)
      |> assign(:display_success?, false)

    {:noreply, socket}
  end

  def handle_event("submit", params, socket) do
    %{"user_profile" => profile_params} = params
    user_profile = socket.assigns.scope.user.profile

    case Accounts.update_user_profile(user_profile, profile_params) do
      {:ok, _updated_profile} ->
        {:noreply, assign(socket, :display_success?, true)}

      {:error, changeset} ->
        {:noreply, assign(socket, :name_form, to_form(changeset, action: :insert))}
    end
  end
end
