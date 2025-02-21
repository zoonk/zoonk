# Glossary

These are some of the terms used in our application. It helps to understand how this application is structured.

## Organization

Zoonk is a multi-tenant application. This means that multiple organizations can use the same instance of the application. Each organization has its own set of members and data.

Our own app deployed at `zoonk.org` is an example of an organization. It has an `admin` kind but organizations can have other kinds such as `team`, `school`, or `store` because we provide a managed cloud service for organizations wanting to use Zoonk as a white-label solution.

Use a [multi tenancy with foreign keys](https://hexdocs.pm/ecto/multi-tenancy-with-foreign-keys.html) approach to implement this.

## App Kind

Zoonk offers multiple products, each with a different `app_kind`. The `app_kind` determines which features are available in the application. Here is a breakdown of them:

| App Kind  | Target | URL            | Description                                                             |
| --------- | ------ | -------------- | ----------------------------------------------------------------------- |
| `:org`    | B2C    | `zoonk.org`    | Learn anything you want.                                                |
| `:team`   | B2B    | `zoonk.team`   | Landing page for our white-label solution for internal training.        |
| `:school` | B2B    | `zoonk.school` | Landing page for our white-label solution for schools and universities. |
| `:store`  | B2B2C  | `zoonk.store`  | Marketplace for creators.                                               |

Some features are only available for certain app kinds. Therefore, we also need to distinguish if a user is visiting the main app (e.g. `zoonk.org`, `zoonk.team`, etc.) or a white-label version (e.g. `myorg.zoonk.team`, `mycustomdomain.com`, etc.). So, we have more app kinds for the white-label versions:

| App Kind              | URL                     | Description                               |
| --------------------- | ----------------------- | ----------------------------------------- |
| `:team_white_label`   | `myteam.zoonk.team`     | White-label for teams.                    |
| `:school_white_label` | `myschool.zoonk.school` | White-label for schools and universities. |
| `:store_white_label`  | `mystore.zoonk.store`   | White-label for creators.                 |

Keep in mind these offerings are not available yet. This is our planned roadmap:

| Product      | Status      | Availability |
| ------------ | ----------- | ------------ |
| zoonk.org    | In Progress | Summer 2025  |
| zoonk.team   | Not Started | Winter 2026  |
| zoonk.school | Not Started | Spring 2026  |
| zoonk.store  | Not Started | Summer 2026  |

## Tracks

Tracks are a collection of courses. They can have multiple courses or other tracks. For example:

| Track            | Sub-tracks                                                 |
| ---------------- | ---------------------------------------------------------- |
| Physics          | Classical Mechanics, Quantum Mechanics, Thermodynamics     |
| Chemistry        | Organic Chemistry, Inorganic Chemistry, Physical Chemistry |
| Biology          | Cell Biology, Genetics, Evolution                          |
| Math             | Algebra, Geometry, Calculus                                |
| Computer Science | Algorithms, Data Structures, Operating Systems             |
| History          | Ancient History, Medieval History, Modern History          |

## Courses

Courses are a collection of lessons. For example:

| Course               | Lessons                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| Intro to Programming | Variables, Data Types, Control Flow, Functions, Arrays, Objects, Loops |
| Chemistry of Life    | Atoms, Molecules, Cells, Tissues, Organs, Organ Systems                |

## Lessons

Lessons are very small units of knowledge. They cover only a single topic for better understanding - and they have a fixed set of exercises:

| Exercise Kind  | Description                                                                       |
| -------------- | --------------------------------------------------------------------------------- |
| `:explanation` | A short but practical explanation of the topic.                                   |
| `:examples`    | Practical examples to understand where and when to use this knowledge.            |
| `:story`       | A hands-on story to understand the topic in a real-world context.                 |
| `:quiz`        | A quiz to test your knowledge.                                                    |
| `:practice`    | A quiz-like exercise to practice what you've learned, focused on your weaknesses. |

## Translations

Zoonk supports multiple languages. This is why we have a `_translations` table for each content type. For example:

| Table       | Translations Table      |
| ----------- | ----------------------- |
| `tracks`    | `track_translations`    |
| `courses`   | `course_translations`   |
| `lessons`   | `lesson_translations`   |
| `exercises` | `exercise_translations` |

This allows us to update all translations at once. For example, if we fix an error in the English translation, we can update all other translations at the same time.

## Dashboard

Each organization has its own dashboard. This is where they can manage members, permissions, and billing.

## Editor

The editor is where the content is created. It allows users to create tracks, courses, lessons, and exercises - either manually or using AI.
