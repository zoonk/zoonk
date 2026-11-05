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
import com.zoonk.android.feature.certificates.CertificateName
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

/** Shows the certificates a run earned, full screen, and calls `onClose` when the learner moves on. */
typealias CertificatesMoment = @Composable (certificates: List<CertificateName>, onClose: () -> Unit) -> Unit

/**
 * Main's `MomentAfterCeremony`: what a finished run earned, the rarest moment first: its
 * [certificates] (oldest first, as the result lists them), then its [milestone] ceremony, when it
 * has them, then its moment.
 */
@Composable
fun MomentAfterCeremony(
    milestone: Milestone?,
    ceremony: MomentCeremony?,
    certificates: List<CertificateName> = emptyList(),
    certificatesMoment: CertificatesMoment? = null,
    moment: @Composable () -> Unit,
) {
    var certificatesClosed by rememberSaveable(certificates.map { it.code }) { mutableStateOf(false) }
    if (certificates.isNotEmpty() && certificatesMoment != null && !certificatesClosed) {
        certificatesMoment(certificates) { certificatesClosed = true }
        return
    }

    var closed by rememberSaveable(milestone?.id) { mutableStateOf(false) }
    val open = milestone?.takeUnless { closed || ceremony == null }
    open?.let { ceremony?.invoke(it) { closed = true } }
    // A badge only gets marked shown, so its moment is already there under it.
    if (open == null || open.kind == Milestone.Kind.BADGE) moment()
}

/** [onSeePlus] opens Plus from a locked certificate's moment. */
@Composable
fun MomentAfterCeremony(
    app: AppContainer,
    milestone: Milestone?,
    certificates: List<CertificateName>,
    onSeePlus: () -> Unit,
    moment: @Composable (MomentBuddy) -> Unit,
) = MomentAfterCeremony(
    milestone = milestone,
    ceremony = { open, onClose -> SessionCeremony(app, open, onClose) },
    certificates = certificates,
    certificatesMoment = { awarded, onClose -> CertificateCeremony(app, awarded, onClose, onSeePlus, app.timeSource) },
) { moment(momentBuddy(app)) }

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
