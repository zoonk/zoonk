defmodule ZoonkWeb.Components.RadioInput do
  @moduledoc """
  A set of components for rendering radio inputs.

  They're styled as cards and it can be combined with
  info cards for a better user experience.

  ## Usage

      <.radio_input name="subscription" value="feature_1">
        <.radio_header>
          <.radio_title>Feature 1</.radio_title>
        </.radio_header>

        <.info_description>
          This is a description of the info card.
        </.info_description>

        <.info_list>
          <.info_list_item icon="tabler-check">
            Feature 1
          </.info_list_item>

          <.info_list_item icon="tabler-check">
            Feature 2
          </.info_list_item>
        </.info_list>
      </.radio_input>
  """
  use Phoenix.Component

  import ZoonkWeb.Components.Icon
  import ZoonkWeb.Components.Text

  alias Phoenix.HTML.FormField

  attr :id, :string, default: nil
  attr :field, FormField, doc: "a form field struct retrieved from the form, for example: @form[:email]"
  attr :value, :any
  attr :name, :any
  attr :checked, :boolean
  attr :label, :string, required: true
  attr :class, :string, default: nil
  slot :inner_block, required: true

  def radio_input(%{field: %FormField{} = field} = assigns) do
    assigns
    |> assign(field: nil, id: assigns.id || field.id)
    |> assign_new(:name, fn -> field.name end)
    |> assign_new(:checked, fn -> to_string(field.value) == to_string(assigns.value) end)
    |> radio_input()
  end

  def radio_input(assigns) do
    assigns = assign_new(assigns, :checked, fn -> false end)

    ~H"""
    <label class="group cursor-pointer select-none">
      <input
        type="radio"
        name={@name}
        value={to_string(@value)}
        checked={@checked}
        class="peer sr-only"
      />

      <div class={[
        "flex flex-col gap-4 overflow-hidden rounded-xl border p-4 transition-all",
        "border-zk-border",
        "peer-checked:shadow-zk-primary/20 peer-checked:border-zk-primary peer-checked:shadow-md",
        "peer-focus-visible:outline-zk-primary peer-focus-visible:outline-2",
        @class
      ]}>
        {render_slot(@inner_block)}
      </div>
    </label>
    """
  end

  attr :class, :string, default: nil
  slot :inner_block, required: true

  def radio_header(assigns) do
    ~H"""
    <div class={["flex items-start justify-between", @class]}>
      <div class="flex-1">
        {render_slot(@inner_block)}
      </div>

      <div class={[
        "size-4 flex shrink-0 items-center justify-center",
        "border-zk-border rounded-full border",
        "group-has-[:checked]:border-zk-primary group-has-[:checked]:bg-zk-primary"
      ]}>
        <.icon
          name="tabler-check"
          size={:xs}
          class="text-white opacity-0 transition-opacity group-has-[:checked]:opacity-100"
        />
      </div>
    </div>
    """
  end

  attr :badge_label, :string, default: nil
  attr :badge_color, :atom, values: [:primary, :secondary], default: :primary
  attr :class, :string, default: nil
  slot :inner_block, required: true

  def radio_title(assigns) do
    ~H"""
    <.text
      tag="h3"
      size={:md}
      weight={:semibold}
      class={["flex items-center gap-2 leading-6", @class]}
    >
      {render_slot(@inner_block)}

      <span
        :if={@badge_label}
        class={[
          "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
          @badge_color == :primary && "bg-zk-primary text-zk-primary-foreground",
          @badge_color == :secondary && "bg-zk-secondary text-zk-secondary-foreground"
        ]}
      >
        {@badge_label}
      </span>
    </.text>
    """
  end
end
