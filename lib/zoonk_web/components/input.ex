defmodule ZoonkWeb.Components.Input do
  @moduledoc """
  Provides the UI for rendering input fields.
  """
  use Phoenix.Component

  import ZoonkWeb.Components.Text

  alias Phoenix.HTML.FormField

  @doc """
  Renders an input with label and error messages.

  A `Phoenix.HTML.FormField` may be passed as argument,
  which is used to retrieve the input name, id, and values.
  Otherwise all attributes may be passed explicitly.

  ## Types

  This function accepts all HTML input types, considering that:

    * You may also set `type="select"` to render a `<select>` tag

    * `type="checkbox"` is used exclusively to render boolean values

    * For live file uploads, see `Phoenix.Component.live_file_input/1`

  See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input
  for more information. Unsupported types, such as hidden and radio,
  are best written directly in your templates.

  ## Examples

      <.input field={@form[:email]} type="email" />
      <.input name="my-input" errors={["oh no!"]} />
  """
  attr :id, :any, default: nil
  attr :name, :any
  attr :label, :string, default: nil
  attr :value, :any
  attr :class, :any, default: nil, doc: "additional classes to apply to the input"

  attr :hide_label, :boolean,
    default: false,
    doc: "if true, the label will be hidden - used only for screen readers"

  attr :type, :string,
    default: "text",
    values: ~w(checkbox color date datetime-local email file hidden month number password
               range search select tel text textarea time url week)

  attr :field, FormField, doc: "a form field struct retrieved from the form, for example: @form[:email]"

  attr :errors, :list, default: []
  attr :checked, :boolean, doc: "the checked flag for checkbox inputs"
  attr :prompt, :string, default: nil, doc: "the prompt for select inputs"
  attr :options, :list, doc: "the options to pass to Phoenix.HTML.Form.options_for_select/2"
  attr :multiple, :boolean, default: false, doc: "the multiple flag for select inputs"

  attr :rest, :global, include: ~w(accept autocomplete capture cols disabled form list max maxlength min minlength
                multiple pattern placeholder readonly required rows size step)

  def input(%{field: %FormField{} = field} = assigns) do
    errors = if Phoenix.Component.used_input?(field), do: field.errors, else: []

    assigns
    |> assign(field: nil, id: assigns.id || field.id)
    |> assign(:errors, Enum.map(errors, &translate_error(&1)))
    |> assign_new(:name, fn -> if assigns.multiple, do: field.name <> "[]", else: field.name end)
    |> assign_new(:value, fn -> field.value end)
    |> input()
  end

  def input(%{type: "checkbox"} = assigns) do
    assigns =
      assign_new(assigns, :checked, fn ->
        Phoenix.HTML.Form.normalize_value("checkbox", assigns[:value])
      end)

    ~H"""
    <div class="text-left">
      <label class="text-zk-foreground flex items-center gap-2 text-sm leading-6">
        <input type="hidden" name={@name} value="false" disabled={@rest[:disabled]} />

        <input
          type="checkbox"
          id={@id}
          name={@name}
          value="true"
          checked={@checked}
          class={[
            "border-zk-border rounded-sm border focus-visible:ring-zk-primary focus-visible:outline-0",
            @class
          ]}
          {@rest}
        />
        <span class={@hide_label && "sr-only"}>{@label}</span>
      </label>

      <.error :for={msg <- @errors}>{msg}</.error>
    </div>
    """
  end

  def input(%{type: "select"} = assigns) do
    ~H"""
    <div class="text-left">
      <.label hide_label={@hide_label} for={@id}>{@label}</.label>

      <select
        id={@id}
        name={@name}
        multiple={@multiple}
        class={[shared_class(), border_class(@errors), @class]}
        {@rest}
      >
        <option :if={@prompt} value="">{@prompt}</option>
        {Phoenix.HTML.Form.options_for_select(@options, @value)}
      </select>

      <.error :for={msg <- @errors}>{msg}</.error>
    </div>
    """
  end

  def input(%{type: "textarea"} = assigns) do
    ~H"""
    <div class="text-left">
      <.label hide_label={@hide_label} for={@id}>{@label}</.label>

      <textarea
        id={@id}
        name={@name}
        class={["min-h-[6rem] resize-none", shared_class(), border_class(@errors), @class]}
        {@rest}
      >{Phoenix.HTML.Form.normalize_value("textarea", @value)}</textarea>

      <.error :for={msg <- @errors}>{msg}</.error>
    </div>
    """
  end

  # All other inputs text, datetime-local, url, password, etc. are handled here...
  def input(assigns) do
    ~H"""
    <div class="text-left">
      <.label :if={@type != "hidden"} hide_label={@hide_label} for={@id}>{@label}</.label>

      <input
        type={@type}
        name={@name}
        id={@id}
        value={Phoenix.HTML.Form.normalize_value(@type, @value)}
        class={[shared_class(), border_class(@errors), @class]}
        {@rest}
      />

      <.error :for={msg <- @errors}>{msg}</.error>
    </div>
    """
  end

  @doc """
  Renders a label.
  """
  attr :for, :string, default: nil
  attr :hide_label, :boolean, default: false
  slot :inner_block, required: true

  def label(assigns) do
    ~H"""
    <.text
      tag="label"
      size={:sm}
      for={@for}
      class={["font-semibold leading-8", @hide_label && "sr-only"]}
    >
      {render_slot(@inner_block)}
    </.text>
    """
  end

  @doc """
  Generates a generic error message.
  """
  slot :inner_block, required: true

  def error(assigns) do
    ~H"""
    <p class="text-zk-destructive mt-2 text-sm">
      {render_slot(@inner_block)}
    </p>
    """
  end

  defp shared_class,
    do: [
      "block rounded border-1",
      "bg-zk-surface text-zk-foreground",
      "placeholder:text-zk-foreground/40",
      "focus-visible:outline-0",
      "sm:text-sm sm:leading-6",
      "disabled:cursor-not-allowed disabled:opacity-50"
    ]

  defp border_class([]), do: "border-zk-border focus-visible:ring-zk-ring"
  defp border_class(_errors), do: "border-zk-destructive focus-visible:ring-zk-destructive-accent"

  @doc """
  Translates an error message using gettext.
  """
  def translate_error({msg, opts}) do
    # When using gettext, we typically pass the strings we want
    # to translate as a static argument:
    #
    #     # Translate the number of files with plural rules
    #     dngettext("errors", "1 file", "%{count} files", count)
    #
    # However the error messages in our forms and APIs are generated
    # dynamically, so we need to translate them by calling Gettext
    # with our gettext backend as first argument. Translations are
    # available in the errors.po file (as we use the "errors" domain).
    if count = opts[:count] do
      Gettext.dngettext(Zoonk.Gettext, "errors", msg, msg, count, opts)
    else
      Gettext.dgettext(Zoonk.Gettext, "errors", msg, opts)
    end
  end

  @doc """
  Translates the errors for a field from a keyword list of errors.
  """
  def translate_errors(errors, field) when is_list(errors) do
    for {^field, {msg, opts}} <- errors, do: translate_error({msg, opts})
  end
end
