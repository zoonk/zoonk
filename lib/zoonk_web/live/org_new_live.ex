defmodule ZoonkWeb.OrgNewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Orgs
  alias Zoonk.Orgs.Org

  on_mount {ZoonkWeb.UserAuthorization, :ensure_org_member}
  on_mount {ZoonkWeb.UserAuthorization, :ensure_system_org}

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.AppLayout.render flash={@flash} scope={@scope}>
      <.multi_step_form
        for={@form}
        current_step={@current_step}
        steps={steps()}
        submit_label={dgettext("orgs", "Create organization")}
        done_label={dgettext("orgs", "Go to your organization")}
        navigate={~p"/"}
      >
        <.multi_step_form_fieldset
          :if={@current_step == 1}
          phx-window-keydown="next"
          phx-key="Enter"
          title={dgettext("orgs", "Set up your organization")}
          subtitle={
            dgettext(
              "orgs",
              "Once it’s ready, you can create your own courses or give your team and students access to our catalog."
            )
          }
        />

        <.multi_step_form_fieldset
          :if={@current_step == 2}
          title={dgettext("orgs", "What's the name of your organization?")}
          subtitle={dgettext("orgs", "This name will be visible to all users.")}
        >
          <.input
            field={@form[:display_name]}
            label={dgettext("orgs", "Name")}
            hide_label
            phx-mounted={JS.focus()}
            required
          />
        </.multi_step_form_fieldset>

        <.multi_step_form_fieldset
          :if={@current_step == 3}
          title={dgettext("orgs", "Choose your organization’s subdomain")}
          subtitle={
            dgettext(
              "orgs",
              "This is the address used to access your organization's page. E.g. <myorg>.zoonk.app"
            )
          }
        >
          <.input
            :if={@current_step == 3}
            field={@form[:subdomain]}
            label={dgettext("orgs", "Subdomain")}
            hide_label
            phx-mounted={JS.focus()}
            required
          />
        </.multi_step_form_fieldset>
      </.multi_step_form>
    </ZoonkWeb.AppLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    org_changeset = Orgs.change_org(%Org{})

    {:ok,
     socket
     |> assign(:page_title, dgettext("page_title", "Set up your organization"))
     |> assign(:current_step, 1)
     |> assign(:org, %Org{})
     |> assign(:form, to_form(org_changeset))}
  end

  @impl Phoenix.LiveView
  def handle_event("validate", %{"org" => params}, socket) do
    org = socket.assigns.org

    changeset =
      org
      |> Orgs.change_org(params)
      |> Map.put(:action, :validate)

    updated_org = Map.merge(org, changeset.changes)

    {:noreply,
     socket
     |> assign(:form, to_form(changeset))
     |> assign(:org, updated_org)}
  end

  def handle_event("previous", _params, socket) do
    current_step = socket.assigns.current_step
    new_step = max(current_step - 1, 1)

    {:noreply, assign(socket, current_step: new_step)}
  end

  def handle_event("next", _params, socket) do
    current_step = socket.assigns.current_step
    new_step = min(current_step + 1, total_steps())

    {:noreply, assign(socket, current_step: new_step)}
  end

  def handle_event("submit", _params, socket) do
    current_step = socket.assigns.current_step
    new_step = min(current_step + 1, total_steps())

    {:noreply, assign(socket, current_step: new_step)}
  end

  defp total_steps, do: length(steps())

  defp steps do
    [
      %{label: dgettext("orgs", "Start"), field: nil},
      %{label: dgettext("orgs", "Name"), field: :display_name},
      %{label: dgettext("orgs", "Subdomain"), field: :subdomain},
      %{label: dgettext("orgs", "Visibility"), field: :is_public},
      %{label: dgettext("orgs", "Mode"), field: :mode},
      %{label: dgettext("orgs", "Done"), field: :done}
    ]
  end
end
