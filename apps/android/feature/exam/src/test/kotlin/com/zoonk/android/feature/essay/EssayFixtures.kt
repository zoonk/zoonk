package com.zoonk.android.feature.essay

import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.practice.UnusedSessionSteps
import com.zoonk.api.ApiJson
import com.zoonk.api.models.Essay
import com.zoonk.api.models.EssaySubmissionInput
import com.zoonk.api.models.SaveWritingDraft
import com.zoonk.api.models.StudyBlockCompletion
import com.zoonk.api.models.WritingAttempt
import com.zoonk.api.models.WritingDraft
import com.zoonk.api.models.WritingResultOutput
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.runBlocking
import kotlinx.datetime.LocalDate
import kotlinx.serialization.builtins.serializer
import java.io.File
import java.util.UUID

internal val ESSAY_BLOCK: UUID = UUID.fromString("00000000-0000-4000-8000-0000000000b1")
internal val ESSAY_SESSION: UUID = UUID.fromString("00000000-0000-4000-8000-0000000000e1")
internal val ADMISSION: UUID = UUID.fromString("00000000-0000-4000-8000-0000000000a1")
internal val ATTEMPT: UUID = UUID.fromString("00000000-0000-4000-8000-0000000000c1")

internal const val ANSWER_TEXT =
    "The control of public administration ensures that public money is applied lawfully. The Federal Constitution of 1988 " +
        "divides it into two kinds, which complement each other.\n\nInternal control is carried out by each branch over its " +
        "own acts. Exist two types of control, and the external one is exercised by Congress with the help of the TCU."

private const val CRITERIA =
    """[{"comment":"You told the two controls apart with the Constitution's article.","id":"a1","level":"strong",
      "name":"Internal and external control","quote":"divides it into two kinds"},
    {"comment":"You named the TCU's role but none of its powers.","id":"a2","level":"partial",
      "name":"The TCU's powers","quote":null},
    {"comment":"Clear paragraphs in a sensible order.","id":"presentation","level":"complete",
      "name":"Presentation and structure","quote":null}]"""

private const val NEXT_STEP =
    """{"criterionId":"a2","example":"The TCU judges the accounts of public administrators.",
    "quote":"exercised by Congress with the help of the TCU","text":"Name two of the TCU's powers and the article that gives them."}"""

private const val ERRORS = """[{"correction":"There are two types","kind":"agreement","quote":"Exist two types","start":240}]"""

/** What real grading shows today: a level per criterion, no total. */
internal const val LEVELS_RESULT =
    """{"kind":"levels","criteria":$CRITERIA,"errors":$ERRORS,"ignoredFrom":null,"nextStep":$NEXT_STEP,"progress":null}"""

/** The same answer on the notice's scale, once its rubric passes its check. */
internal const val POINTS_RESULT =
    """{"kind":"points","criteria":$CRITERIA,"errors":$ERRORS,"ignoredFrom":null,"nextStep":$NEXT_STEP,
    "progress":{"fixed":["a1"],"persists":["a2"]},"max":30,"content":{"low":17,"high":19.2},"deduction":{"low":0.3,"high":0.4},
    "total":{"low":16.6,"high":18.9},"zeroReason":null,"decimals":0,
    "rows":[{"id":"a1","earned":9.5,"max":9.5,"decimals":1},{"id":"a2","earned":4.75,"max":9.5,"decimals":1},{"id":"presentation","earned":3,"max":11,"decimals":0}]}"""

/** Off topic, under the notice's rule that zeroes it. */
internal const val ZEROED_RESULT =
    """{"kind":"points","criteria":$CRITERIA,"errors":[],"ignoredFrom":null,"nextStep":null,"progress":null,
    "max":30,"content":{"low":0,"high":0},"deduction":{"low":0,"high":0},"total":{"low":0,"high":0},"decimals":0,
    "zeroReason":"An answer off the topic asked gets zero.","rows":[{"id":"a1","earned":0,"max":9.5,"decimals":1}]}"""

private const val COMPLETE_CRITERIA =
    """[{"comment":"Both controls, told apart.","id":"a1","level":"complete","name":"Internal and external control","quote":null},
    {"comment":"Two powers and their article.","id":"a2","level":"complete","name":"The TCU's powers","quote":null},
    {"comment":"Clear paragraphs in a sensible order.","id":"presentation","level":"complete",
      "name":"Presentation and structure","quote":null}]"""

/** Every criterion complete and every line read: nothing left to work on. */
internal const val DONE_RESULT =
    """{"kind":"levels","criteria":$COMPLETE_CRITERIA,"errors":[],"ignoredFrom":null,"nextStep":null,"progress":null}"""

/** Full marks, but the text runs past the limit: the step is to fit it in. */
internal const val LIMIT_RESULT =
    """{"kind":"points","criteria":$COMPLETE_CRITERIA,"errors":[],"ignoredFrom":180,"decimals":0,
    "nextStep":{"criterionId":"a1","kind":"limit","title":null,"text":"","quote":null,"example":null},"progress":null,
    "max":30,"content":{"low":29,"high":30},"deduction":{"low":0,"high":0},"total":{"low":29,"high":30},"zeroReason":null,
    "rows":[{"id":"a1","earned":9.5,"max":9.5,"decimals":1},{"id":"a2","earned":9.5,"max":9.5,"decimals":1},{"id":"presentation","earned":11,"max":11,"decimals":0}]}"""

/** Zeroed off topic, with the kind the server now names. */
internal const val ZEROED_KIND_RESULT =
    """{"kind":"points","criteria":$CRITERIA,"errors":[],"ignoredFrom":null,"progress":null,"zeroKind":"offTopic",
    "nextStep":{"criterionId":"a1","kind":"zero","title":null,"text":"","quote":null,"example":null},
    "max":30,"content":{"low":0,"high":0},"deduction":{"low":0,"high":0},"total":{"low":0,"high":0},"decimals":0,
    "zeroReason":"An answer off the topic asked gets zero.","rows":[{"id":"a1","earned":0,"max":9.5,"decimals":1}]}"""

internal fun result(json: String): WritingResultOutput = ApiJson.decodeFromString(WritingResultOutput.serializer(), json)

internal const val WRITING =
    """{"charactersPerLine":55,"keySource":"practiceKey","lines":30,"minimumWords":30,"points":30,"taskKey":"short",
    "title":"Internal and external control","unit":"answer","partMinimum":{"max":100,"minimum":{"unit":"points","value":50}},
    "criteria":[{"id":"a1","name":"Internal and external control","points":9.5},{"id":"a2","name":"The TCU's powers","points":9.5},
    {"id":"presentation","name":"Presentation and structure","points":11}]}"""

/** A CGU-like 30-line question, with a saved [draft] and graded answers ([graded], newest first). */
internal fun essay(
    draft: String? = null,
    draftRevision: Int = 1,
    graded: List<String> = emptyList(),
    status: String = "active",
    withContext: Boolean = true,
): Essay {
    val drafts =
        graded.mapIndexed { index, grade ->
            """{"attemptId":"00000000-0000-4000-8000-0000000000c${index + 1}","grade":$grade,"submittedAt":"2026-11-20T10:00:00Z",
            "text":${ApiJson.encodeToString(String.serializer(), ANSWER_TEXT)}}"""
        }
    val saved =
        draft?.let {
            """{"admissionId":"$ADMISSION","revision":$draftRevision,"text":${ApiJson.encodeToString(String.serializer(), it)}}"""
        } ?: "null"
    val context =
        if (withContext) {
            "\"The Federal Constitution of 1988 gives Congress, with the help of the Federal Court of Accounts (TCU), the external " +
                "control of public administration, and each branch its own internal control.\""
        } else {
            "null"
        }
    return ApiJson.decodeFromString(
        Essay.serializer(),
        """{"admissionId":"$ADMISSION","blockId":"$ESSAY_BLOCK","sessionId":"$ESSAY_SESSION","context":$context,"draft":$saved,
        "drafts":[${drafts.joinToString(",")}],"gradesLeft":3,"pacing":{"minutes":70,"source":"estimated"},
        "question":"Explain the difference between internal and external control of public administration, and the role of the TCU.",
        "rubric":"points","status":"$status","writing":$WRITING}""",
    )
}

/** An essay API answering from settable parts, recording what it was sent. */
internal class FakeEssayApi(
    var read: Essay = essay(),
) : EssayApi {
    var starts = ArrayDeque<WritingStartAnswer>()
    var defaultStart: WritingStartAnswer = WritingStartAnswer.Ready(ADMISSION)
    val started = mutableListOf<UUID?>()
    var startError: com.zoonk.android.data.ApiException? = null

    /** Each save's answer in turn; once empty, a save is kept at the next revision. */
    val saveAnswers = ArrayDeque<DraftSave>()
    val saved = mutableListOf<SaveWritingDraft>()

    /** While set, a save waits for it, as a slow network would. */
    var saveGate: CompletableDeferred<Unit>? = null

    /** While set, a save fails with it, as with no connection. */
    var saveError: com.zoonk.android.data.ApiException? = null

    var grade: suspend (EssaySubmissionInput) -> WritingResultOutput = { awaitCancellation() }
    val submitted = mutableListOf<EssaySubmissionInput>()

    override suspend fun essay(
        session: AuthenticatedSession,
        blockId: UUID,
        timeZone: String,
    ) = read

    override suspend fun start(
        session: AuthenticatedSession,
        blockId: UUID,
        previousAttemptId: UUID?,
    ): WritingStartAnswer {
        started += previousAttemptId
        startError?.let { throw it }
        return starts.removeFirstOrNull() ?: defaultStart
    }

    override suspend fun saveDraft(
        session: AuthenticatedSession,
        blockId: UUID,
        draft: SaveWritingDraft,
    ): DraftSave {
        saved += draft
        saveGate?.await()
        saveError?.let { throw it }
        return saveAnswers.removeFirstOrNull() ?: DraftSave.Saved(WritingDraft(draft.admissionId, draft.revision + 1, draft.text))
    }

    override suspend fun submit(
        session: AuthenticatedSession,
        blockId: UUID,
        input: EssaySubmissionInput,
    ): WritingResultOutput {
        submitted += input
        return grade(input)
    }

    override suspend fun finish(
        session: AuthenticatedSession,
        sessionId: UUID,
        blockId: UUID,
        timeZone: String,
    ): StudyBlockCompletion = error("Not used")

    override suspend fun attempt(
        session: AuthenticatedSession,
        attemptId: UUID,
    ): WritingAttempt = error("Not used")

    override suspend fun createBlock(
        session: AuthenticatedSession,
        goalId: UUID,
        taskKey: String?,
    ): UUID = ESSAY_BLOCK
}

internal val TOMORROW: LocalDate = LocalDate(2026, 11, 21)

/** [api]'s essay read and arrived, for screens that render a view model as it stands. */
internal fun essayViewModel(
    api: FakeEssayApi,
    drafts: File,
): EssayViewModel {
    val cache =
        AppCache(
            FakeSession(AuthenticatedSession(ANA, "token", "local")),
            CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
        )
    val store = EssayStore(api, cache, DraftStore(drafts, CoroutineScope(SupervisorJob()))) { "UTC" }
    val viewModel =
        EssayViewModel(
            api.read.blockId,
            api.read.sessionId,
            store,
            null,
            UnusedSessionSteps,
            CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
        )
    runBlocking { viewModel.essay.refresh() }
    viewModel.arrive((viewModel.essay.state.value as LoadState.Loaded<*>).value as Essay)
    return viewModel
}
