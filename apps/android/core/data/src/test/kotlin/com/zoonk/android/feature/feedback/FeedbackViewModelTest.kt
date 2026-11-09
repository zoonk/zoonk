package com.zoonk.android.feature.feedback

import com.zoonk.android.data.FakeSession
import com.zoonk.api.models.FeedbackSubmission
import com.zoonk.api.models.FeedbackSubmissionContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
class FeedbackViewModelTest {
    private val sent = mutableListOf<FeedbackSubmission>()
    private var reachable = true
    private val sender =
        FeedbackSender({ _, submission ->
            if (!reachable) throw IOException("offline")
            sent += submission
        }, FakeSession(null))
    private val saveTarget = FeedbackTarget("level-test-question", reportType = FeedbackSubmissionContext.ReportType.SAVE_FAILURE)

    @After
    fun reset() = Dispatchers.resetMain()

    @Test
    fun aSaveReportSendsWithoutAReplyEmail() =
        runTest {
            Dispatchers.setMain(StandardTestDispatcher(testScheduler))
            val form = FeedbackViewModel(sender, saveTarget, "I couldn't save my answers.")
            form.onEmailChange("   ")

            assertTrue(form.canSend(null))
            form.send(null)
            advanceUntilIdle()

            val submission = sent.single()
            assertNull(submission.email)
            assertEquals("I couldn't save my answers.", submission.message)
            assertEquals(FeedbackSubmissionContext.ReportType.SAVE_FAILURE, submission.context?.reportType)
            assertEquals("level-test-question", submission.context?.screen)
            assertEquals(FeedbackStatus.Sent, form.status)
        }

    @Test
    fun aMalformedReplyEmailBlocksASaveReport() =
        runTest {
            val form = FeedbackViewModel(sender, saveTarget, "My answers won't save.")
            for (email in listOf("invalid", "learner@", "learner@example", "learner @example.com")) {
                form.onEmailChange(email)
                assertFalse(form.canSend(null))
                form.send(null)
            }
            assertTrue(sent.isEmpty())
        }

    @Test
    fun regularFeedbackStillRequiresAReplyEmail() =
        runTest {
            Dispatchers.setMain(StandardTestDispatcher(testScheduler))
            val form = FeedbackViewModel(sender, FeedbackTarget("support"))
            form.onMessageChange("The timer skips a second.")
            assertFalse(form.canSend(null))
            form.send(null)
            assertTrue(sent.isEmpty())

            form.onEmailChange(" learner@example.com ")
            assertTrue(form.canSend(null))
            form.send(null)
            advanceUntilIdle()
            assertEquals("learner@example.com", sent.single().email)
            assertNull(sent.single().context?.reportType)
        }

    @Test
    fun anAccountReportUsesTheAccountEmail() =
        runTest {
            Dispatchers.setMain(StandardTestDispatcher(testScheduler))
            val form = FeedbackViewModel(sender, saveTarget, "My answers won't save.")
            form.send("account@example.com")
            advanceUntilIdle()
            assertEquals("account@example.com", sent.single().email)
        }

    @Test
    fun aFailedReportKeepsTheEditedMessageForRetry() =
        runTest {
            Dispatchers.setMain(StandardTestDispatcher(testScheduler))
            val form = FeedbackViewModel(sender, saveTarget, "My answers won't save.")
            form.onMessageChange("The second answer still won't save.")
            reachable = false
            form.send(null)
            advanceUntilIdle()
            assertEquals(FeedbackStatus.Failed, form.status)
            assertEquals("The second answer still won't save.", form.message)

            reachable = true
            form.send(null)
            advanceUntilIdle()
            assertEquals("The second answer still won't save.", sent.single().message)
            assertEquals(FeedbackStatus.Sent, form.status)
        }

    @Test
    fun anAccountEmailWithAnApostropheCanSendFeedback() {
        val form = FeedbackViewModel(sender, FeedbackTarget("support"))
        form.onMessageChange("The timer skips a second.")

        assertTrue(form.canSend("o'brien@example.com"))
    }

    @Test
    fun aTypedEmailWithAnApostropheCanSendFeedback() {
        val form = FeedbackViewModel(sender, FeedbackTarget("support"))
        form.onMessageChange("The timer skips a second.")
        form.onEmailChange("o'brien@example.com")

        assertTrue(form.canSend(null))
    }

    @Test
    fun typedEmailsTheServerRejectsStayBlocked() {
        val form = FeedbackViewModel(sender, FeedbackTarget("support"))
        form.onMessageChange("The timer skips a second.")
        for (email in listOf("name@gmail.com.", "name@gmail..com", "joão@gmail.com")) {
            form.onEmailChange(email)
            assertFalse(email, form.canSend(null))
        }
    }

    @Test
    fun aSaveReportStillNeedsAMessage() {
        val form = FeedbackViewModel(sender, saveTarget, "My answers won't save.")
        form.onMessageChange(" ")
        assertFalse(form.canSend(null))
    }
}
