defmodule ZoonkWeb.Live.UserSignIn do
  @moduledoc false
  use ZoonkWeb, :live_view

  import ZoonkWeb.Components.User

  def render(assigns) do
    ~H"""
    <div class="h-dvh mx-auto flex max-w-sm flex-col items-center justify-center gap-4 px-8">
      <h1 class="text-xl font-medium text-neutral-900 dark:text-neutral-100">
        {dgettext("users", "Access your Zoonk account")}
      </h1>

      <section class="w-full">
        <div class="flex flex-col gap-2">
          <.auth_link provider={:apple} />
          <.auth_link provider={:google} />
          <.auth_link provider={:github} />
        </div>

        <.divider label={dgettext("users", "or")} class="my-4" />

        <.auth_link provider={:email} />
      </section>

      <p class="text-neutral-500 dark:text-neutral-300">
        {dgettext("users", "Don't have an account?")}

        <.link href={~p"/signup"} class="text-blue-500 hover:underline">
          {dgettext("users", "Sign up")}
        </.link>
      </p>
    </div>
    """
  end

  def mount(_params, _session, socket) do
    {:ok, socket}
  end
end
