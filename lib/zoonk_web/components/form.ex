defmodule ZoonkWeb.Components.Form do
  @moduledoc """
  Provides the UI for rendering a simple form.
  """
  use Phoenix.Component
  use Gettext, backend: Zoonk.Gettext

  import ZoonkWeb.Components.Button
  import ZoonkWeb.Components.Text

  @form_attrs ~w(autocomplete name rel action enctype method novalidate target multipart)

  @doc """
  Renders a simple form.

  ## Examples

      <.simple_form for={@form} phx-change="validate" phx-submit="save">
        <.input field={@form[:email]} label="Email"/>
        <.input field={@form[:username]} label="Username" />
      </.simple_form>
  """
  attr :for, :any, required: true, doc: "the data structure for the form"
  attr :as, :any, default: nil, doc: "the server side parameter to collect all input under"
  attr :label, :string, default: nil, doc: "the aria-label for the form"
  attr :class, :any, default: nil, doc: "the CSS class to apply to the form"
  attr :rest, :global, include: @form_attrs, doc: "the arbitrary HTML attributes to apply to the form tag"

  slot :inner_block, required: true

  def simple_form(assigns) do
    ~H"""
    <.form :let={f} aria-label={@label} for={@for} as={@as} class={@class} {@rest}>
      {render_slot(@inner_block, f)}
    </.form>
    """
  end

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
  slot :requirements, doc: "the slot for the form requirements"

  def form_container(assigns) do
    ~H"""
    <.simple_form
      for={@for}
      as={@as}
      label={@label}
      class={[
        "bg-zk-surface rounded-md",
        "border-zk-border border dark:border-zk-border-inverse",
        "dark:bg-zk-surface-inverse",
        @class
      ]}
      {@rest}
    >
      <fieldset aria-label={gettext("Form fields")} class="flex flex-col gap-4 p-4 md:p-8">
        <.text aria-hidden="true" element={:h3} size={:header}>{render_slot(@title)}</.text>
        <.text element={:h4} size={:body} variant={:secondary}>{render_slot(@subtitle)}</.text>

        {render_slot(@inner_block)}
      </fieldset>

      <footer
        aria-label={gettext("More information and save button")}
        class={[
          "flex items-center justify-between",
          "bg-zk-surface-hover dark:bg-zk-surface-inverse-hover",
          "px-4 py-2 md:px-8",
          "rounded-b-md"
        ]}
      >
        <.text element={:p} size={:caption} variant={:secondary}>{render_slot(@requirements)}</.text>

        <.button type="submit" size={:sm} phx-disable-with={gettext("Saving...")}>
          {gettext("Save")}
        </.button>
      </footer>
    </.simple_form>
    """
  end
end
