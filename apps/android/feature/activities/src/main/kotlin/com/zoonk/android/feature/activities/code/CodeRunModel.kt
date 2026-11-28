package com.zoonk.android.feature.activities.code

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.Visit
import com.zoonk.android.ui.VisitOf
import com.zoonk.android.ui.components.Limit
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.util.UUID

/** A run on our servers that printed: [code] is the program it ran, to tell whether the learner changed it meanwhile. */
class ServerRun(
    val code: String,
    val run: ProgramRun,
)

sealed interface ServerRunIssue {
    /** No connection reached our servers, or it dropped. */
    data object Offline : ServerRunIssue

    /** Our servers couldn't run it. */
    data object Unavailable : ServerRunIssue

    data class Limited(
        val limit: Limit,
    ) : ServerRunIssue
}

/**
 * A code runner's runs on our servers ([CodeLanguage.runsOnServer]) for one step: whether one is going and how far it got,
 * held for the step's visit, so a run still lands after a rotation and a run that lands after the learner left shows
 * nothing. Running the same program again after a lost connection asks with the same request, which the server answers
 * without running or charging it twice.
 */
class CodeRunModel(
    private val runs: CodeRuns,
) : ViewModel() {
    private var job: Job? = null

    /** The step on screen, until the learner leaves it; a run still going then stops. */
    val visit = Visit(onEnd = { job?.cancel() })

    var isRunning by mutableStateOf(false)
        private set

    /** How far the run got; null until the server says. */
    var phase by mutableStateOf<CodeRunPhase?>(null)
        private set

    /** What the run printed, for the screen to show and answer with. */
    val result = visit.outcome<ServerRun>()

    /** Why the last run didn't print, until the next one starts. */
    val issue = visit.outcome<ServerRunIssue>()

    private var unanswered: Unanswered? = null

    fun run(
        code: String,
        language: CodeLanguage,
    ) {
        if (isRunning) return
        val requestId = unanswered?.takeIf { it.code == code && it.language == language }?.requestId ?: UUID.randomUUID()
        val started = visit.number
        unanswered = Unanswered(requestId, code, language)
        issue.clear()
        isRunning = true
        phase = null
        job =
            viewModelScope.launch {
                try {
                    runs.run(requestId, language, code).collect { update ->
                        when (update) {
                            is CodeRunUpdate.Phase -> phase = update.phase
                            is CodeRunUpdate.Ended -> end(started, code, update.result)
                        }
                    }
                } finally {
                    isRunning = false
                    phase = null
                }
            }
    }

    private fun end(
        started: Int,
        code: String,
        result: MutationResult<ProgramRun>,
    ) {
        val limit = (result as? MutationResult.Failed)?.let(Limit::of)
        // Only a run whose end never reached us is asked again by its request; the server keeps the others' answers.
        if (result !is MutationResult.Failed || result.error != ApiError.Network) unanswered = null

        when {
            result is MutationResult.Done && result.value.stop != ProgramStop.Unavailable -> {
                this.result.send(started, ServerRun(code, result.value))
            }

            limit != null -> {
                issue.send(started, ServerRunIssue.Limited(limit))
            }

            result is MutationResult.Failed && result.error == ApiError.Network -> {
                issue.send(started, ServerRunIssue.Offline)
            }

            result != MutationResult.Obsolete -> {
                issue.send(started, ServerRunIssue.Unavailable)
            }
        }
    }

    private class Unanswered(
        val requestId: UUID,
        val code: String,
        val language: CodeLanguage,
    )
}

/** The step [key]'s runs on our servers, whose visit lasts while this place is composed. */
@Composable
internal fun codeRunModel(key: String): CodeRunModel {
    val runs = LocalCodeRuns.current
    val model = viewModel(key = "codeRun:$key") { CodeRunModel(runs) }
    VisitOf(model.visit)
    return model
}
