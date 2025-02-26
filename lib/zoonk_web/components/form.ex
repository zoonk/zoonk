defmodule ZoonkWeb.Components.Form do
  @moduledoc """
  Provides the UI for rendering a simple form.
  """
  use Phoenix.Component

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
  attr :class, :string, default: nil, doc: "the CSS class to apply to the form"

  attr :rest, :global,
    include: ~w(autocomplete name rel action enctype method novalidate target multipart),
    doc: "the arbitrary HTML attributes to apply to the form tag"

  slot :inner_block, required: true

  def simple_form(assigns) do
    ~H"""
    <.form :let={f} aria-label={@label} for={@for} as={@as} class={["w-full", @class]} {@rest}>
      {render_slot(@inner_block, f)}
    </.form>
    """
  end
end
