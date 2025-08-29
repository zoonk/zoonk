defmodule ZoonkWeb.OrgNewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  on_mount {ZoonkWeb.UserAuthorization, :ensure_org_member}
  on_mount {ZoonkWeb.UserAuthorization, :ensure_system_org}

  @total_steps 5

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.AppLayout.render flash={@flash} scope={@scope}>
      <form
        phx-submit={next_action(@current_step)}
        class="mx-auto mt-4 flex w-full max-w-xl flex-1 flex-col gap-8 lg:mt-8"
      >
        <.stepper current_step={@current_step} total_steps={total_steps()}>
          <:step title={dgettext("orgs", "Start")} />
          <:step title={dgettext("orgs", "Name")} />
          <:step title={dgettext("orgs", "Subdomain")} />
          <:step title={dgettext("orgs", "Visibility")} />
          <:step title={dgettext("orgs", "Done")} />
        </.stepper>

        <main :if={@current_step == 1} class="flex flex-col gap-1">
          <.text tag="h1" size={:xxl}>{dgettext("orgs", "Set up your organization")}</.text>

          <.text tag="h2" size={:md} variant={:secondary}>
            {dgettext(
              "orgs",
              "Once your organization is ready, you can start creating courses for your audience, team, or school."
            )}
          </.text>
        </main>

        <.step_navigation
          current_step={@current_step}
          total_steps={total_steps()}
          submit_label={dgettext("orgs", "Create organization")}
        />
      </form>
    </ZoonkWeb.AppLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    {:ok,
     socket
     |> assign(:page_title, dgettext("page_title", "Set up your organization"))
     |> assign(:current_step, 1)}
  end

  @impl Phoenix.LiveView
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
    {:noreply, socket}
  end

  defp total_steps, do: @total_steps

  defp next_action(current) when current == @total_steps, do: "submit"
  defp next_action(_current), do: "next"
end
