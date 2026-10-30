package com.zoonk.android.feature.ceremonies

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.perform
import com.zoonk.android.data.value
import com.zoonk.api.models.Buddy
import com.zoonk.api.models.Milestone
import kotlinx.coroutines.launch
import java.util.UUID

class MilestoneViews(
    private val api: ApiClients,
    private val cache: AppCache,
) {
    /** So a ceremony shows once, wherever its milestone is read next. */
    suspend fun markShown(milestoneId: UUID): Boolean =
        cache.mutate(invalidating = setOf(DataDomain.UserProgress)) { session ->
            perform { api.clients(session).milestones.createMilestoneView(milestoneId) }
        } is MutationResult.Done
}

/** A finished block's or lesson's ceremony, shown before its moment, as main's `SessionCeremony` is. */
@Composable
fun SessionCeremony(
    app: AppContainer,
    milestone: Milestone,
    onClose: () -> Unit,
) {
    val summary by app.learnerSummary.summary.collectShown()
    val learnerBuddy = summary.value?.buddy
    val moment = learnerBuddy.momentBuddy()

    MilestoneCeremony(
        milestone = milestone,
        buddy = moment.look,
        buddyName = moment.name,
        onShown = { id -> app.scope.launch { app.milestoneViews.markShown(id) } },
        onClose = onClose,
        onWearGlasses =
            learnerBuddy?.let { buddy ->
                { glasses ->
                    app.learningProfile.setBuddy(
                        kind = Buddy.Kind.entries.first { it.value == buddy.kind.value },
                        glasses = Buddy.Glasses.entries.first { it.value == glasses.key },
                        name = buddy.name,
                    )
                }
            },
    )
}
