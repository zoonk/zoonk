defmodule ZoonkWeb.AppFeedbackLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  import ZoonkWeb.Components.FeedbackForm

  alias Zoonk.Support

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
      <.feedback_form
        feedback_form={@feedback_form}
        display_success?={@display_success?}
        show_submit?={false}
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
      |> attach_hook(:feedback_event, :handle_event, &event_hook/3)

    {:ok, socket}
  end
end
