package com.zoonk.android.feature.activities.code

import com.zoonk.android.data.MutationResult
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.flow
import java.util.UUID

/**
 * Runs on our servers that each answer with [updates]: how far it got, then how it ended, which waits for [gate] when
 * one is set (a run still going). Each run's request and code are in [requests].
 */
class ScriptedCodeRuns(
    var updates: List<CodeRunUpdate> = listOf(ended(printed("5050\n"))),
) : CodeRuns {
    val requests = mutableListOf<Pair<UUID, String>>()
    var gate: CompletableDeferred<Unit>? = null

    override fun run(
        requestId: UUID,
        language: CodeLanguage,
        code: String,
    ) = flow {
        requests += requestId to code
        val (progress, end) = updates.partition { it is CodeRunUpdate.Phase }
        progress.forEach { emit(it) }
        gate?.await()
        end.forEach { emit(it) }
    }

    companion object {
        const val RUN_ID = "ec8eedd5-7adf-48aa-b686-ed38e40340b5"

        fun printed(
            output: String,
            stop: ProgramStop = ProgramStop.Done,
            error: ProgramError? = null,
            errorOutput: String = "",
        ) = ProgramRun(error, errorOutput, output, stop, RUN_ID)

        fun ended(run: ProgramRun) = CodeRunUpdate.Ended(MutationResult.Done(run))
    }
}
