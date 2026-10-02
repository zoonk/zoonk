import { type LessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec/rules";

/**
 * A setup lesson as the plan's "I'll set it up" adds it: written by hand in the shape the spec
 * task makes, so the writer is judged on the setup rules (steps for the device, the date the
 * steps were written, checks on what comes next).
 */
export const SETUP_LESSON_SPEC: LessonSpec = {
  canDo: "Run a line of Python in the Windows terminal",
  description:
    "Install Python on Windows from python.org, let the terminal find it, and check that it runs.",
  estimatedMinutes: 4,
  screens: [
    {
      activityTemplate: null,
      brief:
        "On a fresh Windows laptop, typing python in the terminal often opens the Microsoft Store instead of running Python. Ask the learner to guess what happens before they install anything.",
      kind: "hook",
      skills: [],
      visual: null,
    },
    {
      activityTemplate: null,
      brief:
        "Get the free Python 3 installer for Windows from python.org (Downloads, then the Windows button), never from another site.",
      kind: "explanation",
      skills: [0],
      visual: "The python.org downloads page with the Windows download button highlighted.",
    },
    {
      activityTemplate: null,
      brief:
        "Run the installer and tick 'Add python.exe to PATH' before Install Now. PATH is the list of places the terminal looks for programs.",
      kind: "explanation",
      skills: [0],
      visual:
        "The installer's first screen with the 'Add python.exe to PATH' box ticked and Install Now highlighted.",
    },
    {
      activityTemplate: null,
      brief:
        "The installer finished, but python still opens the Microsoft Store. Ask what went wrong. Tempting wrong answer: the download was broken. Right: the PATH box wasn't ticked, so run the installer again and choose Modify.",
      kind: "check",
      skills: [0],
      visual: null,
    },
    {
      activityTemplate: null,
      brief:
        "Check it works in three moves: open Terminal from the Start menu, type python --version and read 'Python 3.x', then type python and print('Hello') and see Hello, and leave with exit().",
      kind: "workedExample",
      skills: [0],
      visual: "A Windows Terminal window showing python --version and a print line.",
    },
    {
      activityTemplate: null,
      brief:
        "The next chapter asks the learner to run a script. They type python --version and see 'Python 3.13.1'. Ask what that tells them. Tempting wrong answer: Python still isn't installed.",
      kind: "application",
      skills: [0],
      visual: null,
    },
  ],
  skills: [
    {
      description:
        "Install Python 3 on Windows from its official site with PATH set, and check that it runs in the terminal.",
      example: "Typing python --version in Windows Terminal prints Python 3.13.1.",
      hard: true,
      name: "Set up Python on Windows",
      topic: "Python setup",
      useCase: "Getting ready to run the scripts later chapters use on your own computer.",
    },
  ],
  supportMode: "explanationFirst",
  title: "Set up Python on Windows",
};
