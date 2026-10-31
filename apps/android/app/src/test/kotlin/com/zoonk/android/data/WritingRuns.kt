package com.zoonk.android.data

import com.zoonk.api.models.Generation
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf

/** Runs that write what a request needs and say it's ready, or stop with an error; a call's steps by default. */
internal class WritingRuns(
    private val write: String = "writeCall",
    private val ready: String = "callReady",
    var finishes: Boolean = true,
) : GenerationSource {
    val followed = mutableListOf<String>()

    override fun events(id: String): Flow<GenerationEvent> =
        flowOf(
            GenerationEvent(status = "started", step = write),
            if (finishes) GenerationEvent(status = "completed", step = ready) else GenerationEvent(status = "error", step = write),
        ).also { followed += id }

    override suspend fun status(id: String) = if (finishes) Generation.Status.COMPLETED else Generation.Status.FAILED
}

/** A run that writes once the test calls [write]. */
internal class HeldRuns(
    private val first: String = "writeCall",
    private val ready: String = "callReady",
) : GenerationSource {
    private val written = CompletableDeferred<Unit>()

    fun write() = written.complete(Unit)

    override fun events(id: String): Flow<GenerationEvent> =
        flow {
            emit(GenerationEvent(status = "started", step = first))
            written.await()
            emit(GenerationEvent(status = "completed", step = ready))
        }

    override suspend fun status(id: String) = Generation.Status.RUNNING
}

/** Waits that read [runs], signed in as [sessions]'s current session. */
internal fun writingWaits(
    runs: GenerationSource,
    sessions: SessionSource = FakeSession(AuthenticatedSession("ana", "token-a", "local-a")),
) = WritingWaits { kind, scope -> ContentWritingWait(kind, scope, sessions) { runs } }
