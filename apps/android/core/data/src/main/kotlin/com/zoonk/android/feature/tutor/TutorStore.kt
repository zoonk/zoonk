package com.zoonk.android.feature.tutor

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.KeyedResources
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.SessionSource
import com.zoonk.api.models.MemoryChangeReference
import com.zoonk.api.models.PlanChange
import com.zoonk.api.models.PlanChangeDecisionInput
import java.util.UUID

class TutorStore(
    val api: TutorApi,
    val cache: AppCache,
    val sessions: SessionSource,
    val undoMemory: suspend (List<MemoryChangeReference>) -> Boolean,
    val decidePlanChange: suspend (goalId: UUID, changeId: UUID, PlanChangeDecisionInput.Status) -> MutationResult<PlanChange>,
) {
    /** Before its first question a conversation reads as an empty thread, so a sent one can be added to it. */
    val threads: KeyedResources<TutorThreadKey, TutorThread> =
        cache.keyed(Audience.SignedIn) { session, key -> api.thread(key, cursor = null, session) ?: TutorThread.Empty }
}
