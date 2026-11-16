export const REQUEST_STATES: Record<string, string> = {
  "Features/Mock/MockChooserScreen.swift: MockChooser":
    "The chooser holds its PaneSplit. Status is the whole start decision, including accepting fewer questions; closing the chooser discards the decision and selection together.",
  "Features/Onboarding/CourseStartScreen.swift: CourseStartScreen":
    "A newly presented course-start task owns the level and submission error. No split rebuilds it; success replaces its form with goal setup and closing the task discards it.",
  "Features/Onboarding/GoalStartScreen.swift: GoalStartFlow":
    "The submission error returns from the draft to the entry with the learner's words. A new send clears it, late replies check cancellation, and closing the whole start task discards the flow; internal Back is not a new submission.",
  "Features/PlanLink/PlanLinkScreen.swift: PlanLinkScreen":
    "A newly presented shared-plan task owns the minutes and submission error. No split rebuilds it; success replaces the form with goal setup or closes the task for Plan, and closing discards it.",
  "Features/Practice/Challenge/ChallengeScreen.swift: ChallengeScreen":
    "The challenge task owns its action above PracticeTaskLayout. Starts dismiss it before navigating, and closing discards its start/move problems; the split's children never cancel the action.",
  "Features/Voice/Audio/VoiceAnswerRecorder.swift: VoiceAnswerRecorder":
    "Issue is the recording's state, including no speech and the allowance decision, kept with the recorder until another recording or its owning question closes; it is not a separate screen request notice.",
  "Features/Voice/Conversation/CheckpointCallIntro.swift: CheckpointCallIntro":
    "The call task keeps this intro above ConversationIntro's split. Starting replaces it with the conversation; closing discards the intro, including its failure and subscription decision.",
};
