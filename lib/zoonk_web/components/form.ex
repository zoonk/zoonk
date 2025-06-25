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
    <.form
      for={@for}
      as={@as}
      class={["bg-zk-surface border-zk-border rounded border", @class]}
      {@rest}
    >
      <fieldset class="flex flex-col gap-4 p-4">
        <.text tag="h3" size={:xxl} class="leading-none">{render_slot(@title)}</.text>
        <.text tag="h4" size={:md} variant={:secondary}>{render_slot(@subtitle)}</.text>

        {render_slot(@inner_block)}
      </fieldset>

      <footer class={["flex items-center justify-between", "bg-zk-muted rounded-b", "px-4 py-2"]}>
        <.text size={:sm} variant={:secondary}>
          {render_slot(@requirements)}
        </.text>

        <.button type="submit" size={:sm} phx-disable-with={gettext("Saving...")}>
          {gettext("Save")}
        </.button>
      </footer>
    </.form>
    """
  end

  attr :class, :any, default: nil, doc: "the CSS class to apply to the form layout"
  slot :inner_block, required: true, doc: "the inner content of the form layout"

  def form_layout(assigns) do
    ~H"""
    <section class={[
      "mx-auto flex max-w-xl flex-1 flex-col md:items-center md:justify-center",
      @class
    ]}>
      {render_slot(@inner_block)}
    </section>
    """
  end
end
