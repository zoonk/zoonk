defmodule ZoonkWeb.LearnSubjectResultsLive do
  @moduledoc false
  use ZoonkWeb, :live_view

  alias Zoonk.AI
  alias Zoonk.Billing
  alias Zoonk.Billing.BillingAccount
  alias Zoonk.Scope

  on_mount {ZoonkWeb.UserAuthorization, :ensure_org_member}

  @colors [
    "text-red-500",
    "text-orange-500",
    "text-amber-500",
    "text-green-500",
    "text-blue-500",
    "text-indigo-500",
    "text-purple-500",
    "text-violet-500",
    "text-fuchsia-500",
    "text-pink-500",
    "text-gray-500"
  ]

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <.async_page
      :let={suggestions}
      flash={@flash}
      scope={@scope}
      data={@suggestions}
      loading_title={dgettext("goals", "Finding course suggestions")}
      loading_subtitle={
        dgettext(
          "goals",
          "This might take a moment as we find out the best course suggestions to help you get started."
        )
      }
      loading_feature={@input}
      failure_message={dgettext("goals", "Sorry, we had an internal error. Please, try again.")}
      failure_link={~p"/learn"}
      failure_link_text={gettext("Back")}
    >
      <header class="mx-auto py-8 text-center" aria-labelledby="page-header">
        <.text id="page-header" tag="h1" size={:xxl}>
          {dgettext("goals", "Course suggestions")}
        </.text>

        <.text tag="h2" size={:lg} variant={:secondary}>
          {dgettext("goals", "Pick one to get started")}
        </.text>
      </header>

      <ul
        :if={suggestions}
        class="mx-auto max-w-xl"
        phx-window-keydown={JS.navigate(~p"/learn")}
        phx-key="escape"
        aria-label={dgettext("goals", "List of suggested courses")}
      >
        <li :for={{suggestion, index} <- Enum.with_index(suggestions)} class="group">
          <a
            href="#"
            class={[
              "border-zk-border flex justify-between gap-2 border-b py-4",
              "hover:bg-zk-secondary/75",
              "group-first:pt-0 group-last:border-b-0",
              "focus-visible:bg-zk-secondary/75 focus-visible:outline-0"
            ]}
            aria-labelledby={"suggestion-#{index}"}
          >
            <div class="flex flex-col gap-1">
              <.text id={"suggestion-#{index}"} tag="h3" weight={:semibold}>
                {suggestion.title}
              </.text>

              <.text size={:sm} variant={:secondary} class="line-clamp-2">
                {suggestion.description}
              </.text>
            </div>

            <div
              aria-hidden
              class="size-17 bg-zk-secondary/75 flex shrink-0 flex-col items-center justify-center rounded-lg"
            >
              <.dynamic_icon
                name={suggestion.icon}
                default="tabler-book"
                variant={:filled}
                class={["size-8", icon_color(index)]}
              />
            </div>
          </a>
        </li>
      </ul>
    </.async_page>
    """
  end

  @impl Phoenix.LiveView
  def mount(params, session, socket) do
    scope = socket.assigns.scope
    input = params["input"]
    language = session["language"]
    country = user_country(scope)
    attrs = %{input: input, language: language, country: country}

    socket =
      socket
      |> assign(:page_title, dgettext("page_title", "Suggestions for %{input}", input: input))
      |> assign(:input, input)
      |> assign_async(:suggestions, fn -> assign_suggestions(scope, attrs) end)

    {:ok, socket}
  end

  defp icon_color(index) do
    @colors
    |> Enum.shuffle()
    |> Enum.at(index)
  end

  defp assign_suggestions(scope, attrs) do
    case AI.suggest_courses(scope, attrs) do
      {:ok, %{suggestions: suggestions}} -> {:ok, %{suggestions: suggestions}}
      {:error, reason} -> {:error, reason}
    end
  end

  defp user_country(%Scope{} = scope) do
    case Billing.get_billing_account(scope) do
      %BillingAccount{country_iso2: country_iso2} ->
        country_iso2

      nil ->
        ""
    end
  end
end
