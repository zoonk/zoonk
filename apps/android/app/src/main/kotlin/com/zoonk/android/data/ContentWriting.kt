package com.zoonk.android.data

import com.zoonk.api.ContentWritingAnswer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.yield
import retrofit2.Response

/** A request's answer, or the run writing what it needs first (`202` `ContentWriting`). */
sealed interface Written<out T> {
    data class Ready<T>(
        val value: T,
    ) : Written<T>

    data class Writing(
        val generationId: String,
    ) : Written<Nothing>
}

suspend inline fun <reified T> performWritten(noinline call: suspend () -> Response<T>): Written<T> =
    try {
        Written.Ready(perform(call))
    } catch (e: ContentWritingAnswer) {
        Written.Writing(e.generationId)
    }

/**
 * Main's `ContentWriting` and its `WritingWait`: follows the run a request was answered with and
 * sends the request again once it's written. A run in the answer right after a written one would
 * wait forever, so that one fails instead.
 */
class ContentWritingWait(
    val kind: GenerationKind,
    private val scope: CoroutineScope,
    private val sessions: SessionSource,
    generations: (AuthenticatedSession?) -> GenerationSource,
) {
    enum class Answer {
        /** No run to wait on: the screen goes on with the request's own answer. */
        Proceed,
        Waiting,

        /** It still needed writing after its run ended. */
        Failed,
    }

    /** The session the run's request was answered in: its run is read, and its request sent again, only for it. */
    private var owner: AuthenticatedSession? = null
    private val follower =
        GenerationFollower(
            kind,
            scope,
            object : GenerationSource {
                override fun events(id: String) = generations(owner).events(id)

                override suspend fun status(id: String) = generations(owner).status(id)
            },
        )
    private val followed = MutableStateFlow<String?>(null)
    private var resend: (() -> Unit)? = null
    private var written = false
    private var waiting: Job? = null

    /** The run being waited on, until the request sent again after it is answered. */
    val generationId: StateFlow<String?> = followed.asStateFlow()

    val run: StateFlow<GenerationRun> = follower.run

    /** Reads an answer's run ([generationId], null for none); [resend] sends the request again once it's written. */
    fun answered(
        generationId: String?,
        resend: () -> Unit,
    ): Answer {
        val afterWriting = written
        clear()
        if (generationId == null) return Answer.Proceed
        if (afterWriting) return Answer.Failed
        this.resend = resend
        owner = sessions.current
        followed.value = generationId
        follower.follow(generationId)
        waiting =
            scope.launch {
                follower.run.first { it.status == GenerationRun.Status.Ready }
                // A run already written is Ready at once, and the code that got this answer isn't done with it yet.
                yield()
                if (sessions.current != owner) return@launch clear()
                written = true
                resend()
            }
        return Answer.Waiting
    }

    /**
     * The wait's Try again: a lost connection follows the same run, a failed one sends the request
     * again, once, with the wait still showing until it's answered.
     */
    fun retry() {
        if (sessions.current != owner) return clear()
        if (run.value.failure == GenerationFailure.Connection) return follower.retry()
        val again = resend ?: return
        resend = null
        waiting?.cancel()
        written = false
        again()
    }

    fun clear() {
        waiting?.cancel()
        waiting = null
        follower.stop()
        followed.value = null
        written = false
    }
}

/** Makes a screen's [ContentWritingWait], which reads runs with the session signed in when its request was answered. */
fun interface WritingWaits {
    fun create(
        kind: GenerationKind,
        scope: CoroutineScope,
    ): ContentWritingWait
}
