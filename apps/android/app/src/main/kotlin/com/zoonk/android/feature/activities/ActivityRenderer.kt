package com.zoonk.android.feature.activities

import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.android.feature.player.model.ActivityStepContent
import com.zoonk.api.models.ActivityExpected

enum class ActivityPhase { Answering, Checked }

/**
 * What a template's canvas gets. The screen's answer is the player's, never the canvas's own;
 * [expected] and [isCorrect] come from the server's check, so a canvas draws them and never grades.
 * While [isLocked] (being checked or checked) the player takes no new answer, so a canvas changes nothing.
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
) {
    val isChecked: Boolean get() = phase == ActivityPhase.Checked
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
