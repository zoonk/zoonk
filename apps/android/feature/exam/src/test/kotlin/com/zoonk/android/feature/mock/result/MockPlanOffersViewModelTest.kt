package com.zoonk.android.feature.mock.result

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.mock.runner.FakeMockRunApi
import com.zoonk.android.feature.mock.runner.MockRunStore
import com.zoonk.android.feature.mock.runner.RUN_BLOCK
import com.zoonk.android.feature.mock.runner.UNREACHABLE
import com.zoonk.api.models.MockPlanOfferInput.Offer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

@OptIn(ExperimentalCoroutinesApi::class)
class MockPlanOffersViewModelTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val dispatcher = StandardTestDispatcher()
    private val api = FakeMockRunApi(finishedMock())
    private val session = FakeSession(AuthenticatedSession("ana", "token", "local"))

    @Before
    fun main() = Dispatchers.setMain(dispatcher)

    @After
    fun reset() = Dispatchers.resetMain()

    private fun viewModel(): MockPlanOffersViewModel {
        val scope = CoroutineScope(SupervisorJob() + dispatcher)
        return MockPlanOffersViewModel(
            MockRunStore(api, AppCache(session, scope), DraftStore(folder.root, scope, io = dispatcher)) {
                "UTC"
            },
            session,
            RUN_BLOCK,
        )
    }

    @Test
    fun keepingThePlanSendsNothing() =
        runTest(dispatcher) {
            val offers = viewModel()

            offers.keep(listOf(Offer.SKIP, Offer.FOCUS))
            advanceUntilIdle()

            assertEquals(emptyList<Offer>(), api.offers)
            assertEquals(OfferAnswer.Declined, offers.state.value.answers[Offer.FOCUS])
        }

    @Test
    fun anOfferThatDidntSaveIsSentAgainAndASettledOneNever() =
        runTest(dispatcher) {
            val offers = viewModel()
            api.offerFailure = UNREACHABLE

            offers.apply(listOf(Offer.SKIP, Offer.FOCUS))
            advanceUntilIdle()
            assertEquals(OfferAnswer.Failed, offers.state.value.answers[Offer.SKIP])

            api.offerFailure = null
            offers.apply(listOf(Offer.SKIP, Offer.FOCUS))
            advanceUntilIdle()
            offers.apply(listOf(Offer.SKIP, Offer.FOCUS))
            advanceUntilIdle()

            assertEquals(listOf(Offer.SKIP, Offer.FOCUS), api.offers)
            assertEquals(false, offers.state.value.applying)
        }

    @Test
    fun aSessionChangeStopsTheOffersStillToSend() =
        runTest(dispatcher) {
            val offers = viewModel()
            api.afterOffer = { session.session = AuthenticatedSession("bo", "token-b", "local-b") }

            offers.apply(listOf(Offer.SKIP, Offer.FOCUS))
            advanceUntilIdle()

            assertEquals(listOf(Offer.SKIP), api.offers)
            assertEquals(false, offers.state.value.applying)
        }
}
