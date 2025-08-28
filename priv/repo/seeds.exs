# Script for populating the database. You can run it as:
#
#     mix run priv/repo/seeds.exs
#
# Inside the script, you can read and write to any of your
# repositories directly:
#
#     Zoonk.Repo.insert!(%Zoonk.SomeSchema{})
#
# We recommend using the bang functions (`insert!`, `update!`
# and so on) as they will fail if something goes wrong.

alias Zoonk.Accounts.User
alias Zoonk.Accounts.UserProfile
alias Zoonk.Orgs.Org
alias Zoonk.Orgs.OrgMember
alias Zoonk.Orgs.OrgSettings
alias Zoonk.Repo

# Create organizations - one for each kind
system_org =
  Repo.insert!(%Org{
    kind: :system,
    display_name: "Zoonk",
    bio: "The main Zoonk application that serves as a platform for all other organizations.",
    public_email: "contact@zoonk.test",
    icon_url: "https://github.com/zoonk.png",
    logo_url: "https://github.com/zoonk.png",
    subdomain: "zoonk",
    custom_domain: "zoonk.test"
  })

# Create org settings for each org
Repo.insert!(%OrgSettings{
  org_id: system_org.id,
  allowed_domains: ["zoonk.test"]
})

# Create users and assign them to organizations
app_admin =
  Repo.insert!(%User{
    email: "admin@zoonk.test",
    confirmed_at: DateTime.utc_now(),
    year_of_birth: 1990,
    language: :en
  })

app_member =
  Repo.insert!(%User{
    email: "member@zoonk.test",
    confirmed_at: DateTime.utc_now(),
    year_of_birth: 1992,
    language: :en
  })

# Create user profiles
Repo.insert!(%UserProfile{
  is_public: true,
  bio: "App administrator",
  display_name: "App Admin",
  picture_url: "https://github.com/yyx990803.png",
  username: "appadmin",
  user_id: app_admin.id
})

Repo.insert!(%UserProfile{
  is_public: true,
  bio: "Regular app member",
  display_name: "App Member",
  picture_url: "https://github.com/LeaVerou.png",
  username: "appmember",
  user_id: app_member.id
})

# Create org memberships
Repo.insert!(%OrgMember{
  role: :admin,
  org_id: system_org.id,
  user_id: app_admin.id
})

Repo.insert!(%OrgMember{
  role: :member,
  org_id: system_org.id,
  user_id: app_member.id
})
