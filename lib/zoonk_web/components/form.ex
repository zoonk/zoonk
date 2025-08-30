defmodule ZoonkWeb.Components.Form do
  @moduledoc """
  Provides the UI for rendering a simple form.
  """
  use Phoenix.Component
  use Gettext, backend: Zoonk.Gettext

  import ZoonkWeb.Components.Stepper
  import ZoonkWeb.Components.Text

  @form_attrs ~w(autocomplete name rel action enctype method novalidate target multipart)

  @doc """
  Renders a form as a container.
  """
  attr :for, :any, required: true, doc: "the data structure for the form"
  attr :as, :any, default: nil, doc: "the server side parameter to collect all input under"

  attr :label, :string, default: nil, doc: "the aria-label for the form"
  attr :class, :any, default: nil, doc: "the CSS class to apply to the form"
  attr :rest, :global, include: @form_attrs, doc: "the arbitrary HTML attributes to apply to the form tag"

  slot :inner_block, required: true
  slot :title, doc: "the slot for the form title"
  slot :subtitle, doc: "the slot for the form subtitle"

  def form_container(assigns) do
    ~H"""
    <.form
      for={@for}
      as={@as}
      class={["bg-zk-background flex w-full flex-1 flex-col gap-4", @class]}
      {@rest}
    >
      <fieldset class="flex flex-col gap-4 text-left">
        <.text tag="h3" size={:xxl} class="leading-none">{render_slot(@title)}</.text>
        <.text tag="h4" size={:md} variant={:secondary} class="-mt-2">{render_slot(@subtitle)}</.text>

        {render_slot(@inner_block)}
      </fieldset>
    </.form>
    """
  end

  attr :for, :any, required: true, doc: "the data structure for the form"
  attr :current_step, :integer, required: true, doc: "the index of the current step"
  attr :steps, :list, required: true, doc: "the list of steps"
  attr :submit_label, :string, required: true, doc: "the label for the submit button"
  attr :done_label, :string, required: true, doc: "the label for the done button"
  attr :done_link, :global, include: ~w(href method navigate patch), doc: "the link to navigate to when done"
  slot :inner_block, required: true, doc: "the inner block for the multi-step form"

  def multi_step_form(assigns) do
    ~H"""
    <.form
      for={@for}
      phx-change="validate"
      phx-submit={next_action(@current_step, @steps)}
      class="mx-auto mt-4 flex w-full max-w-4xl flex-1 flex-col gap-8 lg:mt-8"
    >
      <.stepper current_step={@current_step} total_steps={length(@steps)}>
        <:step :for={step <- @steps} title={step.label} />
      </.stepper>

      {render_slot(@inner_block)}

      <.step_navigation
        current_step={@current_step}
        total_steps={length(@steps)}
        submit_label={@submit_label}
        done_label={@done_label}
        next_disabled={disabled?(@for, @steps, @current_step)}
        {@done_link}
      />
    </.form>
    """
  end

  attr :title, :string, required: true, doc: "the title of the step"
  attr :subtitle, :string, required: true, doc: "the subtitle of the step"
  attr :rest, :global, doc: "the arbitrary HTML attributes to apply to the fieldset tag"
  slot :inner_block, doc: "the inner block for the fieldset"

  def multi_step_form_fieldset(assigns) do
    ~H"""
    <fieldset class="flex flex-col gap-1.5" {@rest}>
      <.text tag="h1" size={:xxl} class="leading-none">{@title}</.text>
      <.text tag="h2" size={:md} variant={:secondary}>{@subtitle}</.text>

      <div class="mt-4">
        {render_slot(@inner_block)}
      </div>
    </fieldset>
    """
  end

  defp disabled?(%Phoenix.HTML.Form{errors: errors}, steps, current_step) do
    field = Enum.at(steps, current_step - 1).field
    Enum.any?(errors, fn {err_field, _msg} -> err_field == field end)
  end

  defp next_action(current, steps) do
    if current == length(steps) - 1, do: "submit", else: "next"
  end
end
