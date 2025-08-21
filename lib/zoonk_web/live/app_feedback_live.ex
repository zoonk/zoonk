defmodule ZoonkWeb.AppFeedbackLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Support
  alias ZoonkWeb.Components.FeedbackForm

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.SettingsLayout.render
      flash={@flash}
      scope={@scope}
      current_page={:feedback}
      has_form={true}
      form_id="feedback_form"
      save_label={dgettext("settings", "Send feedback")}
      display_success={@display_success?}
    >
      <.live_component
        id="feedback-form-live"
        module={FeedbackForm}
        user={@scope.user}
      />
    </ZoonkWeb.SettingsLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    user_email = if socket.assigns.scope.user, do: socket.assigns.scope.user.email, else: ""
    feedback_changeset = Support.change_feedback(%{email: user_email})

    socket =
      socket
      |> assign(:feedback_form, to_form(feedback_changeset, as: :feedback))
      |> assign(:display_success?, false)
      |> assign(:page_title, dgettext("page_title", "Send feedback"))

    {:ok, socket}
  end

  @impl Phoenix.LiveView
  def handle_info({FeedbackForm, :display_success?, display_success?}, socket) do
    {:noreply, assign(socket, :display_success?, display_success?)}
  end

  def handle_info(_other, socket) do
    {:noreply, socket}
  end
end
