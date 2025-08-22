defmodule ZoonkWeb.UserInterestsLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Accounts
  alias Zoonk.Accounts.UserInterests

  on_mount {ZoonkWeb.UserAuthorization, :ensure_org_member}

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.SettingsLayout.render
      flash={@flash}
      scope={@scope}
      current_page={:interests}
      has_form={true}
      form_id="interests_form"
      display_success={@display_success?}
    >
      <.form_container
        for={@interests_form}
        id="interests_form"
        phx-submit="submit"
        phx-change="validate_interests"
      >
        <:title>
          {dgettext("settings", "Tell us about your interests")}
        </:title>

        <:subtitle>
          {dgettext(
            "settings",
            "Help us personalize your learning experience by sharing your interests, hobbies, and preferences. We'll use this to create exercises with examples that resonate with you."
          )}
        </:subtitle>

        <div class="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
          <!-- Interests & Media Section -->
          <div class="flex flex-col gap-6">
            <.input
              field={@interests_form[:media]}
              label={dgettext("settings", "Favorite books, movies, TV shows, or games")}
              type="textarea"
              placeholder={
                dgettext("settings", "e.g., Star Trek, Harry Potter, The Office, Minecraft...")
              }
              rows="3"
              class="w-full"
            />

            <.input
              field={@interests_form[:hobbies]}
              label={dgettext("settings", "What are your hobbies?")}
              type="textarea"
              placeholder={dgettext("settings", "e.g., photography, gaming, gardening, hiking...")}
              rows="3"
              class="w-full"
            />
          </div>
          
    <!-- Learning Section -->
          <div class="flex flex-col gap-6">
            <.input
              field={@interests_form[:struggles]}
              label={dgettext("settings", "What do you find challenging when learning?")}
              type="textarea"
              placeholder={
                dgettext("settings", "e.g., math concepts, memorization, staying focused...")
              }
              rows="3"
              class="w-full"
            />

            <.input
              field={@interests_form[:examples]}
              label={dgettext("settings", "What types of examples help you learn best?")}
              type="textarea"
              placeholder={
                dgettext(
                  "settings",
                  "e.g., real-world applications, visual diagrams, practical examples..."
                )
              }
              rows="3"
              class="w-full"
            />
          </div>
          
    <!-- Work & Location Section -->
          <div class="flex flex-col gap-6">
            <.input
              field={@interests_form[:work_field]}
              label={dgettext("settings", "What field do you work in?")}
              type="text"
              placeholder={dgettext("settings", "e.g., software engineering, marketing, teaching...")}
              class="w-full"
            />

            <.input
              field={@interests_form[:location]}
              label={dgettext("settings", "Where are you from?")}
              type="text"
              placeholder={dgettext("settings", "e.g., New York, Brazil, London...")}
              class="w-full"
            />
          </div>
        </div>
      </.form_container>
    </ZoonkWeb.SettingsLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    user = socket.assigns.scope.user
    user_interests = Accounts.get_user_interests(%Zoonk.Scope{user: user}) || %UserInterests{}
    interests_changeset = Accounts.change_user_interests(user_interests, %{})

    socket =
      socket
      |> assign(:interests_form, to_form(interests_changeset))
      |> assign(:display_success?, false)
      |> assign(:page_title, dgettext("page_title", "Your interests"))
      |> assign(:interests, user_interests)

    {:ok, socket}
  end

  @impl Phoenix.LiveView
  def handle_event("validate_interests", %{"user_interests" => params}, socket) do
    interests_form =
      socket.assigns.interests
      |> Accounts.change_user_interests(params)
      |> Map.put(:action, :validate)
      |> to_form()

    socket =
      socket
      |> assign(:interests_form, interests_form)
      |> assign(:display_success?, false)

    {:noreply, socket}
  end

  def handle_event("submit", %{"user_interests" => params}, socket) do
    scope = socket.assigns.scope

    case Accounts.upsert_user_interests(scope, params) do
      {:ok, _updated_interests} ->
        {:noreply, assign(socket, :display_success?, true)}

      {:error, changeset} ->
        {:noreply, assign(socket, :interests_form, to_form(changeset, action: :insert))}
    end
  end
end
