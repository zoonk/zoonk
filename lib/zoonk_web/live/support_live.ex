defmodule ZoonkWeb.SupportLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Support

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.SettingsLayout.render
      flash={@flash}
      scope={@scope}
      current_page={:support}
      has_form={true}
      form_id="support_form"
      save_label={dgettext("settings", "Send message")}
      display_success={@display_success?}
    >
      <.form_container
        for={@support_form}
        id="support_form"
        phx-submit="submit"
        phx-change="validate_support"
      >
        <:title>{dgettext("settings", "Contact Support")}</:title>

        <:subtitle>
          {dgettext(
            "settings",
            "Need help? Send us a message and we'll get back to you within %{days} business days. For urgent matters, please email us at %{email}",
            days: Support.response_time_days(),
            email: Support.support_email()
          )}
        </:subtitle>

        <.input
          id="support-email"
          field={@support_form[:email]}
          label={dgettext("settings", "Email address")}
          type="email"
          autocomplete="email"
          required
        />

        <.input
          id="support-message"
          field={@support_form[:message]}
          label={dgettext("settings", "Message")}
          type="textarea"
          placeholder={
            dgettext(
              "settings",
              "Describe your issue or question in detail. Include any error messages, steps you took, and your device/browser information if relevant..."
            )
          }
          rows={5}
          required
          class="w-full"
        />
      </.form_container>

      <div class="mt-16 w-full">
        <.faq_header
          title={dgettext("faq", "Frequently Asked Questions")}
          subtitle={dgettext("faq", "Common questions and answers about using Zoonk")}
        />

        <.faq_all />
      </div>
    </ZoonkWeb.SettingsLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    user_email = if socket.assigns.scope.user, do: socket.assigns.scope.user.email, else: ""
    support_changeset = Support.change_support_request(%{email: user_email})

    socket =
      socket
      |> assign(:support_form, to_form(support_changeset, as: :support))
      |> assign(:display_success?, false)
      |> assign(:page_title, dgettext("page_title", "Support"))

    {:ok, socket}
  end

  @impl Phoenix.LiveView
  def handle_event("validate_support", %{"support" => support_params}, socket) do
    support_form =
      support_params
      |> Support.change_support_request()
      |> Map.put(:action, :validate)
      |> to_form(as: :support)

    socket =
      socket
      |> assign(:support_form, support_form)
      |> assign(:display_success?, false)

    {:noreply, socket}
  end

  def handle_event("submit", %{"support" => support_params}, socket) do
    case Support.send_support_request(support_params["email"], support_params["message"]) do
      {:ok, :sent} ->
        # Clear the form and show success message
        user_email = if socket.assigns.scope.user, do: socket.assigns.scope.user.email, else: ""
        support_changeset = Support.change_support_request(%{email: user_email})

        socket =
          socket
          |> assign(:support_form, to_form(support_changeset, as: :support))
          |> assign(:display_success?, true)

        {:noreply, socket}

      {:error, changeset} ->
        {:noreply, assign(socket, :support_form, to_form(changeset, as: :support, action: :insert))}
    end
  end
end
