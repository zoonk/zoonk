defmodule ZoonkWeb.Live.UserSignIn do
  @moduledoc false
  use ZoonkWeb, :live_view

  import ZoonkWeb.Components.User

  def render(assigns) do
    ~H"""
    <main
      aria-labelledby="signin-title"
      class="h-dvh mx-auto flex max-w-sm flex-col items-center justify-center px-8 text-center"
    >
      <.text id="signin-title" element={:h1} size={:title} class="pb-4">
        {dgettext("users", "Access your Zoonk account")}
      </.text>

      <section
        class="flex w-full flex-col gap-2"
        aria-label={dgettext("users", "Use one of the external providers below:")}
      >
        <.auth_link :for={provider <- [:apple, :google, :github]} provider={provider} />
      </section>

      <section class="w-full" aria-label={dgettext("users", "Or use your email address")}>
        <.divider label={dgettext("users", "or")} class="my-4" />
        <.auth_link provider={:email} />
      </section>

      <.signup_link />
    </main>
    """
  end

  def mount(_params, _session, socket) do
    {:ok, socket}
  end
end
