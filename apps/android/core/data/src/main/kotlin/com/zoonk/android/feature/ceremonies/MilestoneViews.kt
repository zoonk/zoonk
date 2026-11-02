package com.zoonk.android.feature.ceremonies

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
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
