# Glossary

These are some of the terms used in our application. It helps to understand how this application is structured.

## Courses

Courses are the main building blocks of Zoonk. They group multiple chapters and they are used to go deeper into a specific subject. For example:

| Course           | Chapters                                                   |
| ---------------- | ---------------------------------------------------------- |
| Physics          | Classical Mechanics, Quantum Mechanics, Thermodynamics     |
| Chemistry        | Organic Chemistry, Inorganic Chemistry, Physical Chemistry |
| Biology          | Cell Biology, Genetics, Evolution                          |
| Math             | Algebra, Geometry, Calculus                                |
| Computer Science | Algorithms, Data Structures, Operating Systems             |
| History          | Ancient History, Medieval History, Modern History          |

## Chapters

Chapters are a group of lessons. For example:

| Chapter              | Lessons                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| Intro to Programming | Variables, Data Types, Control Flow, Functions, Arrays, Objects, Loops |
| Chemistry of Life    | Atoms, Molecules, Cells, Tissues, Organs, Organ Systems                |

## Lessons

Lessons are very small units of knowledge. They cover only a single topic for better understanding and they have a fixed set of exercises:

| Exercise Kind  | Description                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| `:background`  | Explains the problem that led to a topic’s creation, what came before it, and why it matters. The “why” of a concept. |
| `:explanation` | Covers the key theoretical concepts so the topic is clearly understood. The “what” of a concept.                      |
| `:mechanics`   | Breaks down the processes or systems that make the topic work under the hood. The “how” of a concept.                 |
| `:examples`    | Shows practical, real-world uses or appearances of the topic. The “where” of a concept.                               |
| `:connections` | Relates the topic to the learner’s personal interests and daily life using AI.                                        |
| `:story`       | Puts the learner in an interactive story to experience practical situations tied to the topic.                        |
| `:logic`       | Challenges the learner to use reasoning and critical thinking to solve a problem.                                     |
| `:challenge`   | Presents complex, decision-based problems where choices affect resources and outcomes.                                |
| `:simulation`  | Lets learners manipulate variables to see how actions change a system’s state over time.                              |

### Notes

- Most static exercises also have an interactive counterpart to enhance understanding. It works like a quiz where learners can test their knowledge and receive immediate feedback.
- `:connections`, `:challenge`, and `:simulation` are planned but won't be included in v0.1.

## Translations

Zoonk supports multiple languages. This is why we have a `_translations` table for each content type. For example:

| Table       | Translations Table      |
| ----------- | ----------------------- |
| `courses`   | `course_translations`   |
| `chapters`  | `chapter_translations`  |
| `lessons`   | `lesson_translations`   |
| `exercises` | `exercise_translations` |

This allows us to update all translations at once. For example, if we fix an error in the English translation, we can update all other translations at the same time.
