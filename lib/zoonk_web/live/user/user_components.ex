defmodule ZoonkWeb.Components.User do
  @moduledoc false
  use ZoonkWeb, :html

  alias Zoonk.Configuration

  attr :provider, :atom, values: [:email | Configuration.list_supported_oauth_providers()], required: true
  attr :action, :atom, values: [:signin, :signup], default: :signin

  def auth_link(assigns) do
    ~H"""
    <.link_as_button
      navigate={get_auth_link(@action, @provider)}
      icon={get_icon(@provider)}
      variant={:outline}
      full
    >
      {get_auth_label(@action, @provider)}
    </.link_as_button>
    """
  end

  def signup_link(assigns) do
    ~H"""
    <section
      class={[
        "fixed bottom-0 w-full p-4 sm:p-8",
        "border-zk-border border-t",
        "contrast-more:border-zk-border-inverse",
        "dark:border-zk-border-inverse"
      ]}
      aria-label={dgettext("users", "Create an account")}
    >
      <.text
        id="signup-title"
        aria-hidden="true"
        size={:caption}
        variant={:secondary}
        class="leading-3"
      >
        {dgettext("users", "Don't have an account?")}
      </.text>

      <.a navigate={~p"/signup"} class="text-sm">{dgettext("users", "Sign up")}</.a>
    </section>
    """
  end

  defp get_auth_link(:signin, :email), do: ~p"/login/email"
  defp get_auth_link(:signup, :email), do: ~p"/signup"
  defp get_auth_link(_action, provider), do: ~p"/auth/#{provider}"

  defp get_auth_label(:signin, :email), do: dgettext("users", "Login with Email")
  defp get_auth_label(:signup, :email), do: dgettext("users", "Sign up with Email")

  defp get_auth_label(:signin, provider),
    do: dgettext("users", "Continue with %{provider}", provider: provider_name(provider))

  defp get_auth_label(:signup, provider),
    do: dgettext("users", "Sign up with %{provider}", provider: provider_name(provider))

  defp provider_name(provider) do
    provider
    |> Atom.to_string()
    |> String.capitalize()
  end

  defp get_icon(:apple), do: "tabler-brand-apple-filled"
  defp get_icon(:github), do: "tabler-brand-github-filled"
  defp get_icon(:google), do: "tabler-brand-google-filled"
  defp get_icon(:email), do: "tabler-mail-filled"
end
