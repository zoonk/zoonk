package com.zoonk.android.feature.player.engine

import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.PlayableLesson
import com.zoonk.android.feature.player.model.StepContent

const val LESSON_MAP_STEP_ID = "lesson-map"

/**
 * The lesson's screens and, when it has one, its map, which the queue takes only once the rest is done.
 * The map keeps its icons' room while they're on their way or once any came.
 */
val PlayableLesson.playedSteps: List<LessonStep>
    get() =
        steps +
            listOfNotNull(
                map?.let { map ->
                    val keepsIconRoom = marksPending || map.ideas.any { it.icon != null }
                    LessonStep(LESSON_MAP_STEP_ID, null, StepContent.Map(map, title, keepsIconRoom))
                },
            )

internal val LessonPlayerState.isMapAhead: Boolean
    get() = LESSON_MAP_STEP_ID in steps && LESSON_MAP_STEP_ID !in queue && quickCheck == null

val LessonPlayerState.lessonMap: StepContent.Map?
    get() = steps[LESSON_MAP_STEP_ID]?.content as? StepContent.Map

/** The screens the server knows, leaving out the map the player adds. */
val LessonPlayerState.lessonStepIds: List<String>
    get() = steps.keys.filterNot { it == LESSON_MAP_STEP_ID }
