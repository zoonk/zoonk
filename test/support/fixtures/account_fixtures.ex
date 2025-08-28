defmodule Zoonk.AccountFixtures do
  @moduledoc false
  import Ecto.Query
  import Zoonk.OrgFixtures

  alias Zoonk.Accounts
  alias Zoonk.Accounts.UserInterests
  alias Zoonk.Accounts.UserProfile
  alias Zoonk.Accounts.UserToken
  alias Zoonk.Repo
  alias Zoonk.Scope

  def unique_user_email, do: "user#{System.unique_integer()}@example.com"
  def unique_user_username, do: "user#{System.unique_integer()}"

  def valid_user_attributes(attrs \\ %{}) do
    Enum.into(attrs, %{
      email: unique_user_email(),
      language: :en
    })
  end

  def valid_user_profile_attributes(attrs \\ %{}) do
    user = Map.get_lazy(attrs, :user, fn -> user_fixture() end)

    attrs
    |> Map.delete(:user)
    |> Enum.into(%{username: unique_user_username(), user_id: user.id})
  end

  def valid_user_interests_attributes(attrs \\ %{}) do
    Enum.into(attrs, %{
      struggles: "math, focus",
      work_field: "software engineering",
      location: "New York",
      media: "Star Trek, The Office",
      hobbies: "gaming, reading",
      examples: "practical real-world applications"
    })
  end

  def user_interests_fixture(attrs \\ %{}) do
    user = Map.get_lazy(attrs, :user, fn -> user_fixture() end)

    attrs =
      attrs
      |> Map.delete(:user)
      |> valid_user_interests_attributes()

    %UserInterests{user_id: user.id}
    |> UserInterests.changeset(attrs)
    |> Repo.insert!()
  end

  def unconfirmed_user_fixture(attrs \\ %{}) do
    {:ok, user} =
      attrs
      |> valid_user_attributes()
      |> Accounts.signup_user(scope_fixture(%{user: nil}))

    user
  end

  def user_fixture(attrs \\ %{}) do
    preload = Map.get(attrs, :preload, [])
    fixture = unconfirmed_user_fixture(attrs)
    otp_code = extract_otp_code(Accounts.deliver_login_instructions(fixture))

    UserProfile
    |> Repo.get_by!(user_id: fixture.id)
    |> UserProfile.changeset(%{picture_url: "https://zoonk.test/image.png"})
    |> Repo.update!()

    {:ok, user, _expired_tokens} = Accounts.login_user_by_otp(otp_code, fixture.email)

    Repo.preload(user, preload)
  end

  def scope_fixture(attrs \\ %{}) do
    org_attrs = Enum.into(attrs, %{kind: :system})

    org = Map.get_lazy(attrs, :org, fn -> org_fixture(org_attrs) end)
    user = Map.get_lazy(attrs, :user, fn -> user_fixture() end)
    role = Map.get(attrs, :role, :member)
    org_member = Map.get_lazy(attrs, :org_member, fn -> org_member_fixture(%{org: org, user: user, role: role}) end)

    Scope.set(%Scope{org: org, user: user, org_member: org_member})
  end

  def extract_otp_code({:ok, email}) do
    ~r/\n\s*(?<otp>\d{6})\s*\n/
    |> Regex.named_captures(email.text_body)
    |> Map.fetch!("otp")
  end

  def override_token_authenticated_at(token, authenticated_at) when is_binary(token) do
    UserToken
    |> where([t], t.token == ^token)
    |> Repo.update_all(set: [authenticated_at: authenticated_at])
  end

  def generate_user_otp_code(user) do
    {:ok, otp_code} = UserToken.build_otp_code(user, "login")
    otp_code
  end

  def offset_user_token(token, amount_to_add, unit) do
    dt = DateTime.add(DateTime.utc_now(), amount_to_add, unit)

    UserToken
    |> where([ut], ut.token == ^token)
    |> Repo.update_all(set: [inserted_at: dt, authenticated_at: dt])
  end

  def oauth_fixture(attrs \\ %{}) do
    %{
      "provider" => Map.get(attrs, :provider, :google),
      "email" => Map.get(attrs, :email, unique_user_email()),
      "name" => Map.get(attrs, :name, nil),
      "preferred_username" => Map.get(attrs, :username, nil),
      "picture" => Map.get(attrs, :picture, "https://zoonk.test/image.png"),
      "sub" => Map.get(attrs, :uid, "1234567890")
    }
  end
end
