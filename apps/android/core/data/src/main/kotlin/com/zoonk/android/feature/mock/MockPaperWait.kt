package com.zoonk.android.feature.mock

import com.zoonk.android.data.GenerationFollower
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.GenerationSource
import com.zoonk.api.models.MockWriting
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Main's `MockPreparingNote` run: the run writing the paper a preparing mock waits for, asked for
 * until it starts. With nothing writing it, the wait is [idle] and stops asking.
 */
class MockPaperWait(
    scope: CoroutineScope,
    source: (String?) -> GenerationSource,
    private val read: suspend () -> MockWriting?,
) {
    private val mutableIdle = MutableStateFlow(false)

    /** Nothing is writing the paper now (what was written fell short): the daily preparation goes on with it. */
    val idle: StateFlow<Boolean> = mutableIdle.asStateFlow()

    private var namespace: String? = null

    private val follower =
        GenerationFollower(
            GenerationKind.MockPaper,
            scope,
            object : GenerationSource {
                override fun events(id: String) = source(namespace).events(id)

                override suspend fun status(id: String) = source(null).status(id)
            },
            readGenerationId = ::readId,
        )

    val run: StateFlow<GenerationRun> = follower.run

    fun start() = follower.follow(null)

    fun stop() = follower.stop()

    private suspend fun readId(): String? {
        val writing = read()
        if (writing?.status == MockWriting.Status.NONE) {
            mutableIdle.value = true
            follower.stop()
        }
        namespace = writing?.namespace
        return writing?.generationId
    }
}
