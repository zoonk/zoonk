defmodule ZoonkWeb.AppContactLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Support

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.SettingsLayout.render
      flash={@flash}
      scope={@scope}
      current_page={:contact}
      has_form={true}
      form_id="contact_form"
      save_label={dgettext("settings", "Send message")}
      display_success={@display_success?}
    >
      <.form_container
        for={@contact_form}
        id="contact_form"
        phx-submit="submit"
        phx-change="validate"
      >
        <:title>{dgettext("settings", "Contact us")}</:title>

        <:subtitle>
          {dgettext(
            "settings",
            "Need help? Send us a message and we'll get back to you within %{days} business days. For urgent matters, please email us at %{email}",
            days: Support.response_time_days(),
            email: Support.support_email()
          )}
        </:subtitle>

        <.input
          id="contact-email"
          field={@contact_form[:email]}
          label={dgettext("settings", "Email address")}
          type="email"
          autocomplete="email"
          required
        />

        <.input
          id="contact-message"
          field={@contact_form[:message]}
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

      <div class="mt-8 w-full">
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
    form_changeset = Support.change_support_request(%{email: user_email})

    socket =
      socket
      |> assign(:contact_form, to_form(form_changeset, as: :form))
      |> assign(:display_success?, false)
      |> assign(:page_title, dgettext("page_title", "Contact us"))

    {:ok, socket}
  end

  @impl Phoenix.LiveView
  def handle_event("validate", %{"form" => params}, socket) do
    contact_form =
      params
      |> Support.change_support_request()
      |> Map.put(:action, :validate)
      |> to_form(as: :form)

    {:noreply,
     socket
     |> assign(:contact_form, contact_form)
     |> assign(:display_success?, false)}
  end

  def handle_event("submit", %{"form" => params}, socket) do
    case Support.send_support_request(params["email"], params["message"]) do
      {:ok, :sent} ->
        # Clear the form and show success message
        user_email = if socket.assigns.scope.user, do: socket.assigns.scope.user.email, else: ""
        form_changeset = Support.change_support_request(%{email: user_email})

        socket =
          socket
          |> assign(:contact_form, to_form(form_changeset, as: :form))
          |> assign(:display_success?, true)

        {:noreply, socket}

      {:error, changeset} ->
        {:noreply, assign(socket, :contact_form, to_form(changeset, as: :form, action: :insert))}
    end
  end
end
