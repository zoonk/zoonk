package com.zoonk.android.feature.tutor

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.KeyedResources
import com.zoonk.android.data.SessionSource
import com.zoonk.api.models.MemoryChangeReference

class TutorStore internal constructor(
    internal val api: TutorApi,
    internal val cache: AppCache,
    internal val sessions: SessionSource,
    internal val undoMemory: suspend (List<MemoryChangeReference>) -> Boolean,
) {
    /** Before its first question a conversation reads as an empty thread, so a sent one can be added to it. */
    internal val threads: KeyedResources<TutorThreadKey, TutorThread> =
        cache.keyed(Audience.SignedIn) { session, key -> api.thread(key, cursor = null, session) ?: TutorThread.Empty }
}
