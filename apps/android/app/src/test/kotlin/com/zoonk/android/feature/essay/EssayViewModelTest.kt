package com.zoonk.android.feature.essay

import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.DraftsChange
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.checkpoint.wonCompletion
import com.zoonk.android.feature.player.SessionSteps
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.ApiJson
import com.zoonk.api.models.Essay
import com.zoonk.api.models.EssayGrade
import com.zoonk.api.models.EssaySubmissionInput
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
class EssayViewModelTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val dispatcher = StandardTestDispatcher()
    private val signedIn = AuthenticatedSession(ANA, "token", "local")
    private val blockId = UUID.fromString("00000000-0000-4000-8000-0000000000b1")
    private val sessionId = UUID.fromString("00000000-0000-4000-8000-0000000000e1")
    private var gradesLeft = 3
    private var drafted = false
    private var status = "active"
    private var essayReads = 0
    private var onFinish: () -> Unit = {}
    private var clock = 0L
    private var grading: CompletableDeferred<Unit>? = null
    private var submit: (EssaySubmissionInput) -> EssayGrade = { grade() }
    private var continueSession: () -> MutationResult<AppRoute> = { MutationResult.Done(AppRoute.Today) }
    private val submitted = mutableListOf<EssaySubmissionInput>()
    private val finished = mutableListOf<UUID>()
    private val continued = mutableListOf<UUID>()

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private val gradeJson =
        """{"criteria":[{"comment":"Clear.","example":null,"id":"c3","maxScore":200,"name":"Argument","quote":null,"score":120}],
        "enemInterventionElements":null,"nextStep":{"criterionId":"c3","text":"Back each claim."},"range":{"high":680,"low":600},
        "total":{"maxScore":1000,"score":640},"zeroReason":null}"""

    private fun grade(): EssayGrade = ApiJson.decodeFromString(EssayGrade.serializer(), gradeJson)

    private fun essay(): Essay {
        val drafts = if (drafted) """[{"grade":$gradeJson,"submittedAt":"2026-10-30T10:00:00Z","text":"Elsewhere."}]""" else "[]"
        return ApiJson.decodeFromString(
            Essay.serializer(),
            """{"blockId":"$blockId","context":null,"drafts":$drafts,"gradesLeft":$gradesLeft,"question":"Write about cities.",
            "rubric":"enem","sessionId":"$sessionId","status":"$status"}""",
        )
    }

    private suspend fun TestScope.viewModel(drafts: DraftStore = drafts()): EssayViewModel {
        val cache = AppCache(FakeSession(signedIn), CoroutineScope(SupervisorJob() + dispatcher))
        val api =
            object : EssayApi {
                override suspend fun essay(
                    session: AuthenticatedSession,
                    blockId: UUID,
                    timeZone: String,
                ) = essay().also { essayReads++ }

                override suspend fun submit(
                    session: AuthenticatedSession,
                    blockId: UUID,
                    input: EssaySubmissionInput,
                ): EssayGrade {
                    submitted += input
                    grading?.await()
                    return submit(input)
                }

                override suspend fun finish(
                    session: AuthenticatedSession,
                    sessionId: UUID,
                    blockId: UUID,
                    timeZone: String,
                ) = wonCompletion().also {
                    onFinish()
                    finished += blockId
                }
            }
        val steps =
            object : SessionSteps {
                override suspend fun continueSession(sessionId: UUID): MutationResult<AppRoute> {
                    continued += sessionId
                    return continueSession()
                }

                override suspend fun stop(sessionId: UUID): MutationResult<AppRoute> = error("Not used")
            }
        drafts.follow { DraftsChange(signedIn.accountId) }
        val store = EssayStore(api, cache, drafts) { "UTC" }
        val viewModel = EssayViewModel(blockId, sessionId, store, store.unsentText(signedIn, blockId), steps) { clock }
        viewModel.essay.refresh()
        advanceUntilIdle()
        viewModel.arrive(read(viewModel))
        advanceUntilIdle()
        return viewModel
    }

    private fun read(viewModel: EssayViewModel) = (viewModel.essay.state.value as LoadState.Loaded<*>).value as Essay

    private fun TestScope.drafts() = DraftStore(folder.root, CoroutineScope(SupervisorJob() + dispatcher), io = dispatcher)

    @Test
    fun aSentEssayShowsItsGradeAndLeavesNothingUnsent() =
        runTest(dispatcher) {
            val drafts = drafts()
            val viewModel = viewModel(drafts)
            viewModel.write("Cities grow.")

            viewModel.send()
            advanceUntilIdle()

            assertEquals(EssayMode.Grade, viewModel.ui.value.mode)
            assertEquals(
                listOf("Cities grow."),
                viewModel.ui.value.drafts
                    ?.map { it.text },
            )
            assertEquals(2, viewModel.ui.value.gradesLeft)
            assertEquals(listOf("Cities grow."), read(viewModel).drafts.map { it.text })
            assertNull(drafts.open(signedIn, "essay:$blockId", UnsentEssay.serializer()).value.first())
        }

    @Test
    fun textChangedWhileItsGradedStaysAsTheRewrite() =
        runTest(dispatcher) {
            grading = CompletableDeferred()
            val viewModel = viewModel()
            viewModel.write("Cities grow.")
            viewModel.send()
            runCurrent()

            viewModel.write("Cities grow fast.")
            grading?.complete(Unit)
            advanceUntilIdle()

            assertEquals(EssayMode.Write, viewModel.ui.value.mode)
            assertEquals("Cities grow fast.", viewModel.ui.value.text)
            assertEquals(true, viewModel.ui.value.unsent)
        }

    @Test
    fun textKeptOnTheDeviceComesBackWhenTheEssayOpensAgain() =
        runTest(dispatcher) {
            val drafts = drafts()
            viewModel(drafts).write("Half an essay")
            advanceUntilIdle()

            val again = viewModel(drafts)

            assertEquals("Half an essay", again.ui.value.text)
            assertEquals(EssayMode.Write, again.ui.value.mode)
        }

    @Test
    fun aDraftSentAgainAfterAFailureIsGradedOnce() =
        runTest(dispatcher) {
            submit = { throw ApiException(ApiError.Network) }
            val viewModel = viewModel()
            viewModel.write("Cities grow.")
            viewModel.send()
            advanceUntilIdle()
            assertEquals(EssaySend.Failed, viewModel.ui.value.send)

            submit = { grade() }
            viewModel.send()
            advanceUntilIdle()

            assertEquals(1, submitted.map { it.attemptId }.distinct().size)
            assertEquals(EssayMode.Grade, viewModel.ui.value.mode)
        }

    @Test
    fun aDraftBeingGradedWhenTheProcessEndsIsSentAgainAsTheSameAttempt() =
        runTest(dispatcher) {
            grading = CompletableDeferred()
            val drafts = drafts()
            val before = viewModel(drafts)
            before.write("Cities grow.")
            before.send()
            advanceTimeBy(GAVE_UP)
            runCurrent()

            val after = viewModel(drafts)
            after.send()
            grading?.complete(Unit)
            advanceUntilIdle()

            assertEquals(
                "Cities grow.",
                after.ui.value.drafts
                    ?.first()
                    ?.text,
            )
            assertEquals(2, submitted.size)
            assertEquals(1, submitted.map { it.attemptId }.distinct().size)
        }

    @Test
    fun aGradeThatTakesTooLongCanBeSentAgainWithoutASecondRequest() =
        runTest(dispatcher) {
            grading = CompletableDeferred()
            val viewModel = viewModel()
            viewModel.write("Cities grow.")
            viewModel.send()
            advanceTimeBy(GAVE_UP)
            runCurrent()
            assertEquals(EssaySend.Failed, viewModel.ui.value.send)

            viewModel.send()
            grading?.complete(Unit)
            advanceUntilIdle()

            assertEquals(1, submitted.size)
            assertEquals(EssayMode.Grade, viewModel.ui.value.mode)
        }

    @Test
    fun aGradeThatLandsAfterTheWaitGaveUpShowsOnItsOwn() =
        runTest(dispatcher) {
            grading = CompletableDeferred()
            val viewModel = viewModel()
            viewModel.write("Cities grow.")
            viewModel.send()
            advanceTimeBy(GAVE_UP)
            runCurrent()

            grading?.complete(Unit)
            advanceUntilIdle()

            assertEquals(EssaySend.Idle, viewModel.ui.value.send)
            assertEquals(EssayMode.Grade, viewModel.ui.value.mode)
        }

    @Test
    fun aLaterReadOfTheEssayCountsItsDraftsAndGradesLeft() =
        runTest(dispatcher) {
            val viewModel = viewModel()
            drafted = true
            gradesLeft = 2

            viewModel.essay.refresh()
            advanceUntilIdle()
            viewModel.arrive(read(viewModel))

            assertEquals(
                listOf("Elsewhere."),
                viewModel.ui.value.drafts
                    ?.map { it.text },
            )
            assertEquals(2, viewModel.ui.value.gradesLeft)
        }

    @Test
    fun timeAwayCountsNoMoreThanTheLongestEssay() =
        runTest(dispatcher) {
            val viewModel = viewModel()
            viewModel.write("Cities grow.")

            clock = 10 * 60 * 60 * 1000L
            viewModel.send()
            advanceUntilIdle()

            assertEquals(5_400_000L, submitted.single().durationMs)
        }

    @Test
    fun todaysLimitSaysSoAndKeepsTheText() =
        runTest(dispatcher) {
            submit = { throw ApiException(ApiError.Unavailable, "ESSAY_LIMIT_REACHED", status = 429) }
            val viewModel = viewModel()
            viewModel.write("Cities grow.")

            viewModel.send()
            advanceUntilIdle()

            assertEquals(EssaySend.LimitReached, viewModel.ui.value.send)
            assertEquals("Cities grow.", viewModel.ui.value.text)
        }

    @Test
    fun theDailyTimeLimitSaysSoAndKeepsTheText() =
        runTest(dispatcher) {
            submit = { throw ApiException(ApiError.Unavailable, "DAILY_LIMIT_REACHED", status = 403) }
            val viewModel = viewModel()
            viewModel.write("Cities grow.")

            viewModel.send()
            advanceUntilIdle()

            assertEquals(EssaySend.DailyLimitReached, viewModel.ui.value.send)
            assertEquals("Cities grow.", viewModel.ui.value.text)
        }

    @Test
    fun aCompletedEssayShowsItsLastGradeAndTakesNoDraft() =
        runTest(dispatcher) {
            drafted = true
            status = "completed"
            val viewModel = viewModel()

            assertTrue(viewModel.ui.value.closed)
            assertEquals(EssayMode.Grade, viewModel.ui.value.mode)

            viewModel.rewrite()
            viewModel.write("Cities grow.")
            viewModel.send()
            advanceUntilIdle()

            assertEquals(EssayMode.Grade, viewModel.ui.value.mode)
            assertEquals(emptyList<EssaySubmissionInput>(), submitted)
        }

    @Test
    fun anEssayFinishedElsewhereTurnsReadOnlyOnTheNextRead() =
        runTest(dispatcher) {
            drafted = true
            val viewModel = viewModel()
            viewModel.rewrite()

            status = "completed"
            viewModel.essay.refresh()
            advanceUntilIdle()
            viewModel.arrive(read(viewModel))
            advanceUntilIdle()

            assertTrue(viewModel.ui.value.closed)
        }

    @Test
    fun aFinishThatFailsAfterTheEssayClosedElsewhereTurnsReadOnly() =
        runTest(dispatcher) {
            drafted = true
            val viewModel = viewModel()
            onFinish = {
                status = "completed"
                viewModel.arrive(essay())
                throw ApiException(ApiError.Network)
            }

            viewModel.finish()
            advanceUntilIdle()

            assertTrue(viewModel.ui.value.closed)
        }

    @Test
    fun aSendRefusedBecauseTheBlockClosedReadsTheEssayAgain() =
        runTest(dispatcher) {
            submit = {
                status = "skipped"
                throw ApiException(ApiError.Unavailable, "BLOCK_NOT_ACTIVE", status = 409)
            }
            val viewModel = viewModel()
            val reads = essayReads
            viewModel.write("Cities grow.")

            viewModel.send()
            advanceUntilIdle()
            viewModel.arrive(read(viewModel))
            advanceUntilIdle()

            assertEquals(reads + 1, essayReads)
            assertTrue(viewModel.ui.value.closed)
        }

    @Test
    fun aSkippedEssayWithNoDraftTakesNoDraft() =
        runTest(dispatcher) {
            status = "skipped"
            val viewModel = viewModel()

            assertTrue(viewModel.ui.value.closed)

            viewModel.write("Cities grow.")
            viewModel.send()
            advanceUntilIdle()

            assertEquals(emptyList<EssaySubmissionInput>(), submitted)
        }

    @Test
    fun noGradesLeftTodayKeepsTheDraftFromBeingSent() =
        runTest(dispatcher) {
            gradesLeft = 0
            val viewModel = viewModel()
            viewModel.write("Cities grow.")

            viewModel.send()
            advanceUntilIdle()

            assertEquals(emptyList<EssaySubmissionInput>(), submitted)
        }

    @Test
    fun skippingTheRewriteWaitsForTheGradeThenFinishesTheBlockAndGoesOn() =
        runTest(dispatcher) {
            grading = CompletableDeferred()
            val viewModel = viewModel()
            viewModel.write("Cities grow.")
            viewModel.send()
            runCurrent()

            viewModel.finish()
            runCurrent()
            assertEquals(emptyList<UUID>(), finished)
            grading?.complete(Unit)
            advanceUntilIdle()

            assertEquals(listOf(blockId), finished)
            assertEquals(listOf(sessionId), continued)
            assertEquals(AppRoute.Today, viewModel.move.value.leaving)
        }

    @Test
    fun aFinishedBlockOnlyGoesOn() =
        runTest(dispatcher) {
            drafted = true
            continueSession = { MutationResult.Failed(ApiError.Network) }
            val viewModel = viewModel()
            viewModel.finish()
            advanceUntilIdle()

            viewModel.rewrite()
            viewModel.write("Cities grow.")
            viewModel.send()
            continueSession = { MutationResult.Done(AppRoute.Today) }
            viewModel.finish()
            advanceUntilIdle()

            assertEquals(EssayMode.Grade, viewModel.ui.value.mode)
            assertEquals(emptyList<EssaySubmissionInput>(), submitted)
            assertEquals(listOf(blockId), finished)
            assertEquals(AppRoute.Today, viewModel.move.value.leaving)
        }

    private companion object {
        const val GAVE_UP = 91_000L
    }
}
