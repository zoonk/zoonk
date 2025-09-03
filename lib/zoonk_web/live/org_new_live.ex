defmodule ZoonkWeb.OrgNewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.Orgs
  alias Zoonk.Orgs.Org
  alias ZoonkWeb.OrgNewConfig

  on_mount {ZoonkWeb.UserAuthorization, :ensure_org_member}
  on_mount {ZoonkWeb.UserAuthorization, :ensure_system_org}

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.AppLayout.render flash={@flash} scope={@scope}>
      <.multi_step_form
        for={@form}
        current_step={@current_step}
        steps={OrgNewConfig.steps()}
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
              "These are some of the most common use cases for your organization:"
            )
          }
        >
          <section class="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
            <.info_card :for={use_case <- OrgNewConfig.use_cases()}>
              <.info_header
                icon={use_case.icon}
                title={use_case.title}
                subtitle={use_case.subtitle}
              />

              <.info_description>
                {use_case.description}
              </.info_description>

              <.info_list>
                <.info_list_item :for={benefit <- use_case.benefits} icon={benefit.icon}>
                  {benefit.text}
                </.info_list_item>
              </.info_list>
            </.info_card>
          </section>
        </.multi_step_form_fieldset>

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
          subtitle={dgettext("orgs", "This is the address used to access your organization's page.")}
        >
          <.input
            :if={@current_step == 3}
            field={@form[:subdomain]}
            label={dgettext("orgs", "Subdomain")}
            suffix=".zoonk.app"
            hide_label
            phx-mounted={JS.focus()}
            required
          />
        </.multi_step_form_fieldset>

        <.multi_step_form_fieldset
          :if={@current_step == 4}
          title={dgettext("orgs", "Should your organization be visible to everyone?")}
          subtitle={dgettext("orgs", "Choose whether your organization is public or private.")}
          content_class="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          <.radio_input
            :for={option <- OrgNewConfig.visibility_opts()}
            field={@form[:is_public]}
            value={option.value}
            label={option.label}
          >
            <.radio_header>
              <.radio_title>{option.label}</.radio_title>
            </.radio_header>

            <.info_description>{option.description}</.info_description>

            <.info_list>
              <.info_list_item :for={use_case <- option.use_cases} icon={use_case.icon}>
                {use_case.text}
              </.info_list_item>
            </.info_list>
          </.radio_input>
        </.multi_step_form_fieldset>

        <.input :if={@current_step > 2} type="hidden" field={@form[:display_name]} />
        <.input :if={@current_step > 3} type="hidden" field={@form[:subdomain]} />
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
     |> assign(:form, to_form(org_changeset))}
  end

  @impl Phoenix.LiveView
  def handle_event("validate", %{"org" => params}, socket) do
    changeset =
      %Org{}
      |> Orgs.change_org(params)
      |> Map.put(:action, :validate)

    {:noreply, assign(socket, :form, to_form(changeset))}
  end

  def handle_event("previous", _params, socket) do
    current_step = socket.assigns.current_step
    new_step = max(current_step - 1, 1)

    {:noreply, assign(socket, current_step: new_step)}
  end

  def handle_event("next", params, socket) do
    current_step = socket.assigns.current_step
    new_step = min(current_step + 1, OrgNewConfig.total_steps())

    {:noreply,
     socket
     |> assign(current_step: new_step)
     |> maybe_update_form(params)}
  end

  def handle_event("submit", %{"org" => params}, socket) do
    case Orgs.create_org(params) do
      {:ok, _org} ->
        last_step = OrgNewConfig.total_steps()

        {:noreply, assign(socket, current_step: last_step)}

      {:error, changeset} ->
        {:noreply,
         socket
         |> assign(form: to_form(changeset, action: :insert))
         |> assign(current_step: 2)
         |> put_flash(:error, dgettext("orgs", "Failed to create organization. Please try again or contact support."))}
    end
  end

  defp maybe_update_form(socket, %{"orgs" => params}) do
    changeset = Orgs.change_org(%Org{}, params)
    assign(socket, :form, to_form(changeset))
  end

  defp maybe_update_form(socket, _params), do: socket
end
