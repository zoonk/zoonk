package com.zoonk.android.feature.activities

import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.android.feature.player.model.ActivityStepContent
import com.zoonk.api.models.ActivityBaseMap
import com.zoonk.api.models.ActivityExpected
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck

/** [Explore] draws the canvas on an explanation screen: nothing to answer, and [ActivityProps.expected] is the solved end state when the template checks only that. */
enum class ActivityPhase { Answering, Checked, Explore }

/** Main's `hidesAskedTotal`: a total the question may ask for waits for the check; an interaction check's total is part of the activity. */
fun hidesAskedTotal(
    check: PlayableLibraryStepAnyOfContentOneOfCheck,
    phase: ActivityPhase,
): Boolean =
    check !is PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOf1Value &&
        phase == ActivityPhase.Answering

/**
 * What a template's canvas gets. The screen's answer is the player's, never the canvas's own;
 * [expected] and [isCorrect] come from the server's check, so a canvas draws them and never grades.
 * While [isLocked] (being checked or checked) the player takes no new answer, so a canvas changes nothing.
 * [baseMap] is a map activity's base map as the API draws it, with its places already projected.
 */
data class ActivityProps(
    val content: ActivityStepContent,
    val answer: ActivityAnswer?,
    val expected: ActivityExpected?,
    val isCorrect: Boolean?,
    val phase: ActivityPhase,
    val isLocked: Boolean,
    val onAnswerChange: (ActivityAnswer?) -> Unit,
    val cantListen: Boolean = false,
    val onCantListenChange: (Boolean) -> Unit = {},
    val baseMap: ActivityBaseMap? = null,
) {
    val isChecked: Boolean get() = phase == ActivityPhase.Checked
    val isExploring: Boolean get() = phase == ActivityPhase.Explore
}

data class ActivityBadge(
    @StringRes val label: Int,
    @DrawableRes val icon: Int,
)

/**
 * Main's `ActivityRenderer`: a template's canvas, its badge, whether its check comes before the
 * canvas, whether it shows its data's source, and what a number key picks on its canvas (picking
 * the current answer again clears it). The frame draws everything else.
 */
class ActivityRenderer(
    val badge: (ActivityStepContent) -> ActivityBadge?,
    val canvas: @Composable (ActivityProps) -> Unit,
    val checkFirst: (ActivityStepContent) -> Boolean = { false },
    val showsData: (ActivityStepContent) -> Boolean = { false },
    val keyPick: ((ActivityStepContent, Int) -> ActivityAnswer?)? = null,
)
