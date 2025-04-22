defmodule ZoonkWeb.Components.Spinner do
  @moduledoc """
  Spinner component for indicating loading states.

  This component provides a visual indicator for loading or processing operations
  in the application. Use it whenever the system is performing an asynchronous
  operation and the user needs visual feedback.
  """
  use Phoenix.Component
  use Gettext, backend: Zoonk.Gettext

  import ZoonkWeb.Components.Text

  @doc """
  Renders a spinner with customizable size and color.

  ## Examples

      <.spinner />
      <.spinner variant={:secondary} />
      <.spinner size={:sm} />

  ## Attributes

  - `class` - Additional CSS classes to apply to the spinner
  """
  attr :class, :string, default: nil, doc: "Additional CSS classes for the spinner"

  attr :variant, :atom,
    values: [:primary, :secondary, :white],
    default: :primary,
    doc: "Variant of the spinner"

  attr :size, :atom,
    values: [:xs, :sm, :md, :lg, :xl, :xxl],
    default: :sm

  attr :rest, :global, doc: "Additional HTML attributes"

  def spinner(assigns) do
    ~H"""
    <div
      class={[
        "animate-spin rounded-full border-t-2",
        @variant == :primary && "border-zk-primary",
        @variant == :secondary && "border-zk-secondary-accent",
        @variant == :white && "border-white",
        @size == :xs && "size-4",
        @size == :sm && "size-8",
        @size == :md && "size-12",
        @size == :lg && "size-16",
        @size == :xl && "size-20",
        @size == :xxl && "size-24",
        @class
      ]}
      role="status"
      aria-label={gettext("Loading")}
      {@rest}
    >
    </div>
    """
  end

  @doc """
  Renders a full-page spinner with customizable title and description.

  This component combines the spinner with contextual text to inform users
  about the loading process. Use it for processes that require a full-page
  loading indicator with explanatory text.

  ## Examples

      <.full_page_spinner
        title="Loading your data"
        subtitle="Please wait while we prepare your information."
      />

  """
  attr :id, :string, default: "spinner_#{System.unique_integer()}", doc: "ID of the spinner container"
  attr :class, :any, default: nil, doc: "Additional CSS classes for the container"
  attr :title, :string, required: true, doc: "Main message displayed below the spinner"
  attr :subtitle, :string, default: nil, doc: "Secondary text explaining the loading process"
  attr :feature, :string, default: nil, doc: "Text highlighted in primary color (optional)"

  attr :delay_loading, :boolean,
    default: false,
    doc: "Delay loading spinner to avoid flicker on fast operations"

  attr :rest, :global, doc: "Additional HTML attributes"

  def full_page_spinner(assigns) do
    ~H"""
    <div
      id={@id}
      phx-hook={@delay_loading && "DelayLoading"}
      class={[
        "flex w-full max-w-md flex-col items-center justify-center p-8 text-center",
        @delay_loading && "opacity-0",
        @class
      ]}
      {@rest}
    >
      <div class="mb-8">
        <.spinner size={:md} />
      </div>

      <.text tag="h2" size={:xl} class="mb-4">
        {@title}
        <em :if={@feature} class="text-zk-primary">{@feature}</em>
      </.text>

      <.text variant={:secondary}>
        {@subtitle}
      </.text>
    </div>
    """
  end
end
