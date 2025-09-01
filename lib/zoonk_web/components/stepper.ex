defmodule ZoonkWeb.Components.Stepper do
  @moduledoc """
  Provides UI components for rendering multi-step forms and wizards.
  """
  use Phoenix.Component
  use Gettext, backend: Zoonk.Gettext

  import ZoonkWeb.Components.Anchor
  import ZoonkWeb.Components.Button
  import ZoonkWeb.Components.Icon
  import ZoonkWeb.Components.Text

  @doc """
  Renders a stepper container with multiple steps.

  ## Examples

      <.stepper current_step={2} total_steps={4}>
        <:step title="Personal Info" description="Basic information" />
        <:step title="Account Setup" description="Create your account" />
        <:step title="Preferences" description="Choose your settings" />
        <:step title="Review" description="Confirm details" />
      </.stepper>

      <.stepper current_step={1} total_steps={3} variant={:dots}>
        <:step title="Step 1" />
        <:step title="Step 2" />
        <:step title="Step 3" />
      </.stepper>

      <.stepper current_step={2} total_steps={3} variant={:minimal}>
        <:step title="Basic Info" />
        <:step title="Details" />
        <:step title="Confirm" />
      </.stepper>
  """
  attr :current_step, :integer, required: true, doc: "The current active step (1-indexed)"
  attr :total_steps, :integer, required: true, doc: "Total number of steps"
  attr :variant, :atom, values: [:default, :dots, :minimal], default: :default, doc: "Visual style variant"
  attr :class, :string, default: nil, doc: "Additional CSS classes"
  attr :rest, :global, doc: "Additional HTML attributes"

  slot :step, required: true do
    attr :title, :string, required: true, doc: "Step title"
    attr :description, :string, doc: "Optional step description"
    attr :icon, :string, doc: "Optional step icon"
  end

  def stepper(%{variant: :dots} = assigns) do
    ~H"""
    <nav
      class={["flex items-center justify-center gap-2", @class]}
      aria-label={gettext("Progress")}
      {@rest}
    >
      <div
        :for={{step, index} <- Enum.with_index(@step, 1)}
        class={[
          "size-3 rounded-full transition-colors duration-200",
          completed_or_current?(index, @current_step) && "bg-zk-primary-text",
          upcoming?(index, @current_step) && "bg-zk-muted-foreground/30"
        ]}
        aria-label={step.title}
        title={step.title}
      >
      </div>
    </nav>
    """
  end

  def stepper(%{variant: :minimal} = assigns) do
    ~H"""
    <nav
      class={["flex items-center justify-between", @class]}
      aria-label={gettext("Progress")}
      {@rest}
    >
      <div
        :for={{step, index} <- Enum.with_index(@step, 1)}
        class={["flex-1 text-center", index < length(@step) && "border-zk-border border-r"]}
      >
        <div class={[
          "px-4 py-2 text-sm font-medium transition-colors duration-200",
          current?(index, @current_step) && "text-zk-primary-text",
          completed?(index, @current_step) && "text-zk-muted-foreground",
          upcoming?(index, @current_step) && "text-zk-muted-foreground/50"
        ]}>
          {step.title}
        </div>
      </div>
    </nav>
    """
  end

  def stepper(assigns) do
    ~H"""
    <nav class={["w-full", @class]} aria-label={gettext("Progress")} {@rest}>
      <ol class="flex items-center gap-2">
        <li
          :for={{step, index} <- Enum.with_index(@step, 1)}
          class={["flex items-center", !last?(index, @step) && "flex-1"]}
        >
          <!-- Step circle -->
          <div class="flex items-center">
            <div class={[
              "size-8 flex shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
              completed?(index, @current_step) &&
                "border-zk-primary-text bg-zk-primary-text text-zk-primary-text-foreground",
              current?(index, @current_step) &&
                "border-zk-primary-text bg-zk-background text-zk-primary-text",
              upcoming?(index, @current_step) &&
                "border-zk-muted-foreground/30 bg-zk-background text-zk-muted-foreground"
            ]}>
              <.icon
                :if={Map.get(step, :icon) && !completed?(index, @current_step)}
                name={step.icon}
                size={:xs}
              />

              <.icon
                :if={completed?(index, @current_step)}
                name="tabler-check"
                size={:xs}
              />

              <.text
                :if={!Map.get(step, :icon) && !completed?(index, @current_step)}
                size={:sm}
                weight={:semibold}
                variant={:custom}
              >
                {index}
              </.text>
            </div>
            
    <!-- Step content -->
            <div class="ml-3 hidden lg:block">
              <.text
                size={:sm}
                weight={:medium}
                class={[
                  completed?(index, @current_step) && "text-zk-primary-text",
                  current?(index, @current_step) && "text-zk-primary-text",
                  upcoming?(index, @current_step) && "text-zk-muted-foreground"
                ]}
              >
                {step.title}
              </.text>

              <.text
                :if={Map.get(step, :description)}
                size={:xs}
                variant={:secondary}
                class="mt-0.5"
              >
                {step.description}
              </.text>
            </div>
          </div>
          
    <!-- Connector line -->
          <div
            :if={index < length(@step)}
            class={[
              "ml-4 h-px flex-1 transition-colors duration-200 lg:hidden",
              completed?(index, @current_step) && "bg-zk-primary-text",
              upcoming_or_current?(index, @current_step) && "bg-zk-muted-foreground/30"
            ]}
          >
          </div>
        </li>
      </ol>
    </nav>
    """
  end

  @doc """
  Renders a simple step indicator showing current position.

  ## Examples

      <.step_indicator current={2} total={5} />
      <.step_indicator current={1} total={3} class="my-4" />
  """
  attr :current, :integer, required: true, doc: "Current step number (1-indexed)"
  attr :total, :integer, required: true, doc: "Total number of steps"
  attr :class, :string, default: nil, doc: "Additional CSS classes"
  attr :rest, :global, doc: "Additional HTML attributes"

  def step_indicator(assigns) do
    ~H"""
    <div class={["flex items-center justify-center", @class]} {@rest}>
      <.text size={:sm} variant={:secondary}>
        {gettext("Step %{current} of %{total}", current: @current, total: @total)}
      </.text>
    </div>
    """
  end

  @doc """
  Renders navigation buttons for stepping through a multi-step form.

  ## Examples

      <.step_navigation
        current_step={2}
        total_steps={4}
        on_previous="previous_step"
        on_next="next_step"
      />

      <.step_navigation
        current_step={1}
        total_steps={3}
        on_next="next_step"
        next_label="Continue"
        previous_label="Back"
      />

      <.step_navigation
        current_step={4}
        total_steps={4}
        on_previous="previous_step"
        on_submit="submit_form"
        submit_label="Complete Setup"
      />
  """
  attr :fixed, :boolean, default: false, doc: "Fix navigation to bottom of viewport"
  attr :current_step, :integer, required: true, doc: "Current step number (1-indexed)"
  attr :total_steps, :integer, required: true, doc: "Total number of steps"
  attr :on_previous, :any, default: "previous", doc: "Event handler for previous button"
  attr :previous_label, :string, default: gettext("Previous"), doc: "Label for previous button"
  attr :next_label, :string, default: gettext("Next"), doc: "Label for next button"
  attr :submit_label, :string, default: gettext("Submit"), doc: "Label for submit button"
  attr :done_label, :string, default: gettext("Done"), doc: "Label for done button"
  attr :previous_disabled, :boolean, default: false, doc: "Disable previous button"
  attr :next_disabled, :boolean, default: false, doc: "Disable next button"
  attr :class, :string, default: nil, doc: "Additional CSS classes"
  attr :rest, :global, include: ~w(href method navigate patch), doc: "HTML attributes to apply to the done link"

  def step_navigation(assigns) do
    ~H"""
    <div class={[
      "flex w-full items-center justify-between gap-4",
      !@fixed && "mt-auto",
      @fixed && "bg-zk-background border-zk-border fixed bottom-0 left-0 z-50 border-t px-4 py-3",
      @class
    ]}>
      <.button
        variant={:outline}
        phx-click={@on_previous}
        disabled={@previous_disabled || @current_step == 1}
      >
        {@previous_label}
      </.button>

      <.button
        :if={@current_step < @total_steps}
        type="submit"
        variant={:primary}
        disabled={@next_disabled}
        phx-disable
      >
        {next_label(assigns)}
      </.button>

      <.a :if={@current_step == @total_steps} kind={:button} variant={:primary} {@rest}>
        {@done_label}
      </.a>
    </div>
    """
  end

  defp completed?(index, step), do: index < step
  defp current?(index, step), do: index == step
  defp upcoming?(index, step), do: index > step
  defp completed_or_current?(index, step), do: index <= step
  defp upcoming_or_current?(index, step), do: index >= step
  defp last?(index, steps), do: index == length(steps)

  def next_label(assigns) when assigns.current_step == assigns.total_steps - 1, do: assigns.submit_label
  def next_label(assigns), do: assigns.next_label
end
