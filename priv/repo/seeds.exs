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
app_org =
  Repo.insert!(%Org{
    kind: :app,
    display_name: "Zoonk App",
    bio: "The main Zoonk application that serves as a platform for all other organizations.",
    public_email: "contact@zoonk.test",
    icon_url: "https://github.com/zoonk.png",
    logo_url: "https://github.com/zoonk.png",
    subdomain: "app",
    custom_domain: "zoonk.test"
  })

team_org =
  Repo.insert!(%Org{
    kind: :team,
    display_name: "Sample Team",
    bio: "A sample team organization for internal training.",
    public_email: "team@zoonk.test",
    icon_url: "https://github.com/github.png",
    logo_url: "https://github.com/github.png",
    subdomain: "team"
  })

creator_org =
  Repo.insert!(%Org{
    kind: :creator,
    display_name: "Creative Studio",
    bio: "A content creator organization selling educational materials.",
    public_email: "creator@zoonk.test",
    icon_url: "https://github.com/vercel.png",
    logo_url: "https://github.com/vercel.png",
    subdomain: "creator"
  })

school_org =
  Repo.insert!(%Org{
    kind: :school,
    display_name: "Learn Academy",
    bio: "An educational institution using Zoonk for their students.",
    public_email: "school@zoonk.test",
    icon_url: "https://github.com/rijksuniversiteit-groningen.png",
    logo_url: "https://github.com/rijksuniversiteit-groningen.png",
    subdomain: "school"
  })

# Create org settings for each org
Repo.insert!(%OrgSettings{
  currency: :usd,
  org_id: app_org.id,
  stripe_customer_id: "cus_app123",
  allowed_domains: ["zoonk.test"]
})

Repo.insert!(%OrgSettings{
  currency: :usd,
  org_id: team_org.id,
  stripe_customer_id: "cus_team123",
  allowed_domains: ["team.test", "company.test"]
})

Repo.insert!(%OrgSettings{
  currency: :eur,
  org_id: creator_org.id,
  stripe_customer_id: "cus_creator123",
  allowed_domains: []
})

Repo.insert!(%OrgSettings{
  currency: :sgd,
  org_id: school_org.id,
  stripe_customer_id: "cus_school123",
  allowed_domains: ["school.edu.test"]
})

# Create users and assign them to organizations
app_admin =
  Repo.insert!(%User{
    email: "admin@zoonk.test",
    confirmed_at: DateTime.utc_now(),
    stripe_customer_id: "cus_user1",
    year_of_birth: 1990,
    language: :en
  })

app_member =
  Repo.insert!(%User{
    email: "member@zoonk.test",
    confirmed_at: DateTime.utc_now(),
    stripe_customer_id: "cus_user2",
    year_of_birth: 1992,
    language: :en
  })

team_admin =
  Repo.insert!(%User{
    email: "team-admin@zoonk.test",
    confirmed_at: DateTime.utc_now(),
    stripe_customer_id: "cus_user3",
    year_of_birth: 1985,
    language: :en
  })

team_member =
  Repo.insert!(%User{
    email: "team-member@zoonk.test",
    confirmed_at: DateTime.utc_now(),
    stripe_customer_id: "cus_user4",
    year_of_birth: 1988,
    language: :en
  })

creator_admin =
  Repo.insert!(%User{
    email: "creator-admin@zoonk.test",
    confirmed_at: DateTime.utc_now(),
    stripe_customer_id: "cus_user5",
    year_of_birth: 1982,
    language: :de
  })

creator_member =
  Repo.insert!(%User{
    email: "creator-member@zoonk.test",
    confirmed_at: DateTime.utc_now(),
    stripe_customer_id: "cus_user6",
    year_of_birth: 1986,
    language: :de
  })

school_admin =
  Repo.insert!(%User{
    email: "school-admin@zoonk.test",
    confirmed_at: DateTime.utc_now(),
    stripe_customer_id: "cus_user7",
    year_of_birth: 1975,
    language: :en
  })

school_member =
  Repo.insert!(%User{
    email: "school-member@zoonk.test",
    confirmed_at: DateTime.utc_now(),
    stripe_customer_id: "cus_user8",
    year_of_birth: 1999,
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

Repo.insert!(%UserProfile{
  is_public: true,
  bio: "Team organization administrator",
  display_name: "Team Admin",
  picture_url: "https://github.com/malukang.png",
  username: "teamadmin",
  user_id: team_admin.id
})

Repo.insert!(%UserProfile{
  is_public: false,
  bio: "Team organization member",
  display_name: "Team Member",
  picture_url: "https://github.com/muan.png",
  username: "teammember",
  user_id: team_member.id
})

Repo.insert!(%UserProfile{
  is_public: true,
  bio: "Content creator administrator",
  display_name: "Creator Admin",
  picture_url: "https://github.com/noopkat.png",
  username: "creatoradmin",
  user_id: creator_admin.id
})

Repo.insert!(%UserProfile{
  is_public: true,
  bio: "Content creator team member",
  display_name: "Creator",
  picture_url: "https://github.com/cassidoo.png",
  username: "creator",
  user_id: creator_member.id
})

Repo.insert!(%UserProfile{
  is_public: false,
  bio: "School administrator",
  display_name: "School Admin",
  picture_url: "https://github.com/iheanyi.png",
  username: "schooladmin",
  user_id: school_admin.id
})

Repo.insert!(%UserProfile{
  is_public: false,
  bio: "School student",
  display_name: "Student",
  picture_url: "https://github.com/sonamata.png",
  username: "student",
  user_id: school_member.id
})

# Create org memberships
Repo.insert!(%OrgMember{
  role: :admin,
  org_id: app_org.id,
  user_id: app_admin.id
})

Repo.insert!(%OrgMember{
  role: :member,
  org_id: app_org.id,
  user_id: app_member.id
})

Repo.insert!(%OrgMember{
  role: :admin,
  org_id: team_org.id,
  user_id: team_admin.id
})

Repo.insert!(%OrgMember{
  role: :member,
  org_id: team_org.id,
  user_id: team_member.id
})

Repo.insert!(%OrgMember{
  role: :admin,
  org_id: creator_org.id,
  user_id: creator_admin.id
})

Repo.insert!(%OrgMember{
  role: :member,
  org_id: creator_org.id,
  user_id: creator_member.id
})

Repo.insert!(%OrgMember{
  role: :admin,
  org_id: school_org.id,
  user_id: school_admin.id
})

Repo.insert!(%OrgMember{
  role: :member,
  org_id: school_org.id,
  user_id: school_member.id
})
