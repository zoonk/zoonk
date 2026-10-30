package com.zoonk.android.feature.ceremonies

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
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
import com.zoonk.api.models.Milestone

@Immutable
data class MomentBuddy(
    val look: BuddyLook,
    val name: String,
)

/** Main's `MomentAfterCeremony`: a finished run's [milestone] ceremony, when it has one, then its moment. */
@Composable
fun MomentAfterCeremony(
    app: AppContainer,
    milestone: Milestone?,
    moment: @Composable (MomentBuddy) -> Unit,
) {
    var closed by rememberSaveable(milestone?.id) { mutableStateOf(false) }
    val open = milestone?.takeUnless { closed }
    open?.let { SessionCeremony(app, it, onClose = { closed = true }) }
    // A badge only gets marked shown, so its moment is already there under it.
    if (open == null || open.kind == Milestone.Kind.BADGE) moment(momentBuddy(app))
}

@Composable
fun momentBuddy(app: AppContainer): MomentBuddy {
    val summary by app.learnerSummary.summary.collectShown()
    val buddy = summary.value?.buddy
    val look = buddy?.look() ?: BuddyLook()
    return MomentBuddy(look, buddyName(look.kind, buddy?.name))
}
