# Glossary

These are some of the terms used in our application. It helps to understand how this application is structured.

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
