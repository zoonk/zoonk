package com.zoonk.android.feature.player

import com.zoonk.android.feature.player.engine.LessonPhase
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.LessonScreen
import com.zoonk.android.feature.player.model.StepKind
import com.zoonk.android.feature.player.model.toApi
import com.zoonk.android.feature.tutor.TutorScope

/** What the buddy is asked about on [screen]: the learner's checked answer, the screen, or the lesson before its first screen. */
internal fun LessonPlayerState.tutorScope(screen: LessonScreen): TutorScope {
    val step = screen.step ?: return TutorScope.Lesson(lessonId, steps.keys.toList())
    val number = position + 1
    val checked = answers[step.id]?.takeIf { phase == LessonPhase.Feedback && step.id in results }?.toApi()
    return if (checked != null) TutorScope.Answer(lessonId, step.id, number, checked) else TutorScope.Step(lessonId, step.id, number)
}

/** Main's miss, which words the ask button: a checked answer shown wrong, never a hook's guess. */
internal fun LessonPlayerState.showsMiss(screen: LessonScreen): Boolean {
    val step = screen.step ?: return false
    return phase == LessonPhase.Feedback && results[step.id]?.isCorrect == false && step.content.kind != StepKind.Hook
}
