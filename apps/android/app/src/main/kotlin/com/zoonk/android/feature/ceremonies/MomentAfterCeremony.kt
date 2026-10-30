package com.zoonk.android.feature.ceremonies

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.characters.buddyName
import com.zoonk.android.ui.characters.look
import com.zoonk.api.models.LearnerSummaryBuddy
import com.zoonk.api.models.Milestone

@Immutable
data class MomentBuddy(
    val look: BuddyLook,
    val name: String,
)

/** Shows a milestone's full-screen ceremony and calls `onClose` when the learner leaves it. */
typealias MomentCeremony = @Composable (milestone: Milestone, onClose: () -> Unit) -> Unit

/** Main's `MomentAfterCeremony`: a finished run's [milestone] ceremony, when it has one, then its moment. */
@Composable
fun MomentAfterCeremony(
    milestone: Milestone?,
    ceremony: MomentCeremony?,
    moment: @Composable () -> Unit,
) {
    var closed by rememberSaveable(milestone?.id) { mutableStateOf(false) }
    val open = milestone?.takeUnless { closed || ceremony == null }
    open?.let { ceremony?.invoke(it) { closed = true } }
    // A badge only gets marked shown, so its moment is already there under it.
    if (open == null || open.kind == Milestone.Kind.BADGE) moment()
}

@Composable
fun MomentAfterCeremony(
    app: AppContainer,
    milestone: Milestone?,
    moment: @Composable (MomentBuddy) -> Unit,
) = MomentAfterCeremony(milestone, { open, onClose -> SessionCeremony(app, open, onClose) }) { moment(momentBuddy(app)) }

@Composable
fun momentBuddy(app: AppContainer): MomentBuddy {
    val summary by app.learnerSummary.summary.collectShown()
    return summary.value?.buddy.momentBuddy()
}

@Composable
@ReadOnlyComposable
fun LearnerSummaryBuddy?.momentBuddy(): MomentBuddy {
    val look = this?.look() ?: BuddyLook()
    return MomentBuddy(look, buddyName(look.kind, this?.name))
}
