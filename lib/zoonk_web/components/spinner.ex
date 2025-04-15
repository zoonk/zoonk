defmodule ZoonkWeb.Components.Spinner do
  @moduledoc """
  Spinner component for indicating loading states.

  This component provides a visual indicator for loading or processing operations
  in the application. Use it whenever the system is performing an asynchronous
  operation and the user needs visual feedback.
  """
  use Phoenix.Component
  use Gettext, backend: Zoonk.Gettext

  @doc """
  Renders a spinner with customizable size and color.

  ## Examples

      <.spinner />
      <.spinner class="size-12" />
      <.spinner class="text-zk-primary" />

  ## Attributes

  - `class` - Additional CSS classes to apply to the spinner
  """
  attr :class, :string, default: "size-6", doc: "Additional CSS classes for the spinner"
  attr :rest, :global, doc: "Additional HTML attributes"

  def spinner(assigns) do
    ~H"""
    <div
      class={["text-zk-foreground/40 animate-spin", @class]}
      role="status"
      aria-label={gettext("Loading")}
      {@rest}
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="h-full w-full">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
    """
  end
end
