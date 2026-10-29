package com.zoonk.android.data

import com.zoonk.api.models.Generation
import kotlinx.coroutines.flow.Flow

/** A run's events and status from the API, with [session]'s token: what a screen's `GenerationFollower` reads. */
class LiveGenerationSource(
    private val api: ApiClients,
    private val session: AuthenticatedSession?,
) : GenerationSource {
    override fun events(id: String): Flow<GenerationEvent> = api.generationEvents(id, session)

    override suspend fun status(id: String): Generation.Status = perform { api.clients(session).workflows.getGeneration(id) }.status
}
