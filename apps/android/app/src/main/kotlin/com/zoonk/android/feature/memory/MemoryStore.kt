package com.zoonk.android.feature.memory

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.Resource
import com.zoonk.api.models.Memory

fun interface MemoryApi {
    suspend fun memory(session: AuthenticatedSession): Memory
}

/** What the buddy remembers, read by the settings hub's count and the memory page. */
class MemoryStore(
    api: MemoryApi,
    cache: AppCache,
) {
    val memory: Resource<Memory> =
        cache.resource(Audience.SignedIn, setOf(DataDomain.Memory)) { session -> session?.let { api.memory(it) } }
}
