defmodule ZoonkWeb.UIPreview.StepperPreviewLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <ZoonkWeb.UIPreview.UIPreviewLayout.render
      active_page={:stepper}
      page_title={@page_title}
      grid="grid grid-cols-1 lg:grid-cols-2 gap-4"
    >
      <.card>
        <.card_header>
          <.card_title>Default Stepper</.card_title>
          <.card_description>
            A full-featured stepper with steps, descriptions, and progress indicators.
          </.card_description>
        </.card_header>

        <.card_content>
          <.stepper current_step={2} total_steps={4}>
            <:step title="Personal Info" description="Enter your basic information" />
            <:step title="Account Setup" description="Create your account credentials" />
            <:step title="Preferences" description="Choose your settings and preferences" />
            <:step title="Review" description="Review and confirm your details" />
          </.stepper>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Default Stepper without Descriptions</.card_title>
          <.card_description>
            A full-featured stepper with steps and progress indicators.
          </.card_description>
        </.card_header>

        <.card_content>
          <.stepper current_step={2} total_steps={4}>
            <:step title="Personal Info" />
            <:step title="Account Setup" />
            <:step title="Preferences" />
            <:step title="Review" />
          </.stepper>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Stepper with Icons</.card_title>
          <.card_description>Stepper steps can include custom icons.</.card_description>
        </.card_header>

        <.card_content>
          <.stepper current_step={3} total_steps={4}>
            <:step title="Profile" description="Personal information" icon="tabler-user" />
            <:step
              title="Security"
              description="Password and security settings"
              icon="tabler-shield-check"
            />
            <:step title="Billing" description="Payment information" icon="tabler-credit-card" />
            <:step title="Complete" description="Finish setup" icon="tabler-check" />
          </.stepper>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Dots Variant</.card_title>
          <.card_description>A minimal dots-only progress indicator.</.card_description>
        </.card_header>

        <.card_content>
          <.stepper current_step={2} total_steps={5} variant={:dots}>
            <:step title="Step 1" />
            <:step title="Step 2" />
            <:step title="Step 3" />
            <:step title="Step 4" />
            <:step title="Step 5" />
          </.stepper>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Minimal Variant</.card_title>
          <.card_description>A clean horizontal layout with step titles only.</.card_description>
        </.card_header>

        <.card_content>
          <.stepper current_step={2} total_steps={3} variant={:minimal}>
            <:step title="Basic Info" />
            <:step title="Details" />
            <:step title="Confirm" />
          </.stepper>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Step Indicator</.card_title>
          <.card_description>Simple step counter for showing current position.</.card_description>
        </.card_header>

        <.card_content>
          <.step_indicator current={3} total={7} />
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Step Navigation</.card_title>
          <.card_description>Navigation buttons for multi-step forms.</.card_description>
        </.card_header>

        <.card_content class="space-y-6">
          <div>
            <.text size={:sm} variant={:secondary} class="mb-2">
              First step (previous disabled):
            </.text>
            <.step_navigation
              current_step={1}
              total_steps={4}
              on_next="next_step"
              on_previous="previous_step"
              on_submit="submit_form"
            />
          </div>

          <div>
            <.text size={:sm} variant={:secondary} class="mb-2">Middle step (both buttons):</.text>
            <.step_navigation
              current_step={2}
              total_steps={4}
              on_previous="previous_step"
              on_next="next_step"
              on_submit="submit_form"
            />
          </div>

          <div>
            <.text size={:sm} variant={:secondary} class="mb-2">Final step (submit button):</.text>
            <.step_navigation
              current_step={4}
              total_steps={4}
              on_previous="previous_step"
              on_next="next_step"
              on_submit="submit_form"
              submit_label="Complete Setup"
            />
          </div>

          <div>
            <.text size={:sm} variant={:secondary} class="mb-2">Custom labels:</.text>
            <.step_navigation
              current_step={2}
              total_steps={3}
              on_previous="previous_step"
              on_next="next_step"
              on_submit="submit_form"
              previous_label="Go Back"
              next_label="Continue"
            />
          </div>
        </.card_content>
      </.card>

      <.card>
        <.card_header>
          <.card_title>Interactive Demo</.card_title>
          <.card_description>
            Try navigating through the steps using the buttons below.
          </.card_description>
        </.card_header>

        <.card_content class="space-y-6">
          <.stepper current_step={@demo_step} total_steps={4}>
            <:step title="Welcome" description="Getting started with the demo" />
            <:step title="Configuration" description="Set up your preferences" />
            <:step title="Preview" description="Review your settings" />
            <:step title="Finish" description="Complete the process" />
          </.stepper>

          <.step_navigation
            current_step={@demo_step}
            total_steps={4}
            on_previous="demo_previous"
            on_next="demo_next"
            on_submit="demo_submit"
            submit_label="Finish Demo"
          />

          <.text size={:sm} variant={:secondary} class="text-center">
            Current step: {@demo_step} of 4
          </.text>
        </.card_content>
      </.card>
    </ZoonkWeb.UIPreview.UIPreviewLayout.render>
    """
  end

  @impl Phoenix.LiveView
  def mount(_params, _session, socket) do
    {:ok,
     socket
     |> assign(page_title: "Stepper")
     |> assign(demo_step: 1)}
  end

  @impl Phoenix.LiveView
  def handle_event("demo_next", _params, socket) do
    current_step = socket.assigns.demo_step
    new_step = min(current_step + 1, 4)
    {:noreply, assign(socket, demo_step: new_step)}
  end

  def handle_event("demo_previous", _params, socket) do
    current_step = socket.assigns.demo_step
    new_step = max(current_step - 1, 1)
    {:noreply, assign(socket, demo_step: new_step)}
  end

  def handle_event("demo_submit", _params, socket) do
    # Reset to first step for demo purposes
    {:noreply, assign(socket, demo_step: 1)}
  end

  # Placeholder event handlers for the static examples
  def handle_event(event, _params, socket) when event in ["next_step", "previous_step", "submit_form"] do
    {:noreply, socket}
  end
end
