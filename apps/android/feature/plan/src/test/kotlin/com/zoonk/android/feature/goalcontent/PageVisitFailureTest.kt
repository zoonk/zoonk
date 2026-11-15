package com.zoonk.android.feature.goalcontent

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.Visit
import com.zoonk.android.feature.language.AlphabetApi
import com.zoonk.android.feature.language.AlphabetSkipModel
import com.zoonk.android.feature.language.AlphabetStore
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanOp
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.api.models.LanguageUnits
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import java.util.UUID

/**
 * What a page's write says (a failure line, a practice that opens) belongs to the visit that asked: one that lands
 * after the learner left shows nothing on return, and one already shown is gone once they leave and come back.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PageVisitFailureTest {
    private val dispatcher = StandardTestDispatcher()
    private val held = CompletableDeferred<Unit>()
    private val failure = ApiException(ApiError.Network)
    private val goalId = UUID.fromString(GOAL)
    private val key = ChapterKey(goalId, UUID.fromString(chapterId(3)))
    private val cache =
        AppCache(FakeSession(AuthenticatedSession("ana", "token-a", "local-a")), CoroutineScope(SupervisorJob() + dispatcher))

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    /** [ask] with its write held; the learner leaves before it answers ([leaveFirst]) or after it shows, then comes back. */
    private fun check(
        visit: Visit,
        leaveFirst: Boolean,
        ask: () -> Unit,
        shown: () -> Any?,
    ) = runTest(dispatcher) {
        ask()
        runCurrent()
        if (leaveFirst) {
            visit.end()
            held.complete(Unit)
            advanceUntilIdle()
        } else {
            held.complete(Unit)
            advanceUntilIdle()
            assertNotNull("it shows on the visit that asked", shown())
            visit.end()
        }
        assertNull(shown())
    }

    private fun alphabet(leaveFirst: Boolean) {
        val api =
            object : AlphabetApi {
                override suspend fun units(
                    session: AuthenticatedSession,
                    goalId: UUID,
                ): LanguageUnits = error("Not used")

                override suspend fun skipAlphabet(
                    session: AuthenticatedSession,
                    goalId: UUID,
                ) {
                    held.await()
                    throw failure
                }
            }
        val model = AlphabetSkipModel(AlphabetStore(api, cache))
        check(model.visit, leaveFirst, { model.skip(goalId) }) { model.failed.takeIf { it } }
    }

    private fun chapter(
        leaveFirst: Boolean,
        fails: Boolean,
    ) {
        val api =
            FakeGoalContentApi().apply {
                val opens = practice
                practice = {
                    held.await()
                    if (fails) throw failure
                    opens()
                }
            }
        val model = ChapterViewModel(GoalContentStore(api, cache), key)
        check(model.visit, leaveFirst, model::practice) { model.state.outcome }
    }

    private fun subject(leaveFirst: Boolean) {
        val restore = PlanOp.RestoreAreas(listOf("area"))
        val plans = FakePlanApi().apply { gates[restore] = held }.apply { changeFailure = failure }
        val model = SubjectViewModel(PlanStore(plans, cache), cache.resource(Audience.SignedIn, emptySet()) { null }, goalId)
        check(model.visit, leaveFirst, { model.restore(listOf("area")) }) { model.state.restoreFailed.takeIf { it } }
    }

    @Test
    fun anAlphabetSkipThatFailsAfterTheLearnerLeftSaysNothingOnReturn() = alphabet(leaveFirst = true)

    @Test
    fun anAlphabetSkipFailureShownBeforeTheLearnerLeftIsGoneOnReturn() = alphabet(leaveFirst = false)

    @Test
    fun aPracticeThatOpensAfterTheLearnerLeftOpensNothingOnReturn() = chapter(leaveFirst = true, fails = false)

    @Test
    fun aPracticeThatFailsAfterTheLearnerLeftSaysNothingOnReturn() = chapter(leaveFirst = true, fails = true)

    @Test
    fun aPracticeFailureShownBeforeTheLearnerLeftIsGoneOnReturn() = chapter(leaveFirst = false, fails = true)

    @Test
    fun aSubjectChangeThatFailsAfterTheLearnerLeftSaysNothingOnReturn() = subject(leaveFirst = true)

    @Test
    fun aSubjectChangeFailureShownBeforeTheLearnerLeftIsGoneOnReturn() = subject(leaveFirst = false)
}
