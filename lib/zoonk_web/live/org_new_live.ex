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
      <.form
        for={@form}
        phx-change="validate"
        phx-submit={next_action(@current_step)}
        class="mx-auto mt-4 flex w-full max-w-4xl flex-1 flex-col gap-8 lg:mt-8"
      >
        <.stepper current_step={@current_step} total_steps={total_steps()}>
          <:step :for={step <- steps()} title={step.title} />
        </.stepper>

        <div
          :if={@current_step == 1}
          class="flex flex-col gap-1"
          phx-window-keydown={next_action(@current_step)}
          phx-key="Enter"
        >
          <.text tag="h1" size={:xxl}>{dgettext("orgs", "Set up your organization")}</.text>

          <.text tag="h2" size={:md} variant={:secondary}>
            {dgettext(
              "orgs",
              "Once it’s ready, you can create your own courses or give your team and students access to our catalog."
            )}
          </.text>
        </div>

        <.input
          :if={@current_step == 2}
          field={@form[:display_name]}
          label={dgettext("orgs", "Name")}
          hide_label
          required
        />

        <.input
          :if={@current_step == 3}
          field={@form[:subdomain]}
          label={dgettext("orgs", "Subdomain")}
          hide_label
          required
        />

        <.step_navigation
          current_step={@current_step}
          total_steps={total_steps()}
          submit_label={dgettext("orgs", "Create organization")}
          done_label={dgettext("orgs", "Go to your organization")}
          navigate={~p"/"}
          next_disabled={disabled?(@form, @current_step)}
        />
      </.form>
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

  defp next_action(current) do
    if current == total_steps() - 1, do: "submit", else: "next"
  end

  defp steps do
    [
      %{title: dgettext("orgs", "Start")},
      %{title: dgettext("orgs", "Name")},
      %{title: dgettext("orgs", "Subdomain")},
      %{title: dgettext("orgs", "Visibility")},
      %{title: dgettext("orgs", "Mode")},
      %{title: dgettext("orgs", "Done")}
    ]
  end

  defp disabled?(%Phoenix.HTML.Form{errors: errors}, current_step) do
    Enum.any?(errors, fn {err_field, _msg} -> err_field == field(current_step) end)
  end

  defp field(2), do: :display_name
  defp field(3), do: :subdomain
  defp field(_step), do: :other
end
