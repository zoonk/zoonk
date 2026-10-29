package com.zoonk.android.feature.player.engine

import com.zoonk.android.feature.player.checkStep
import com.zoonk.android.feature.player.explanationStep
import com.zoonk.android.feature.player.fillBlankStep
import com.zoonk.android.feature.player.hookGuessStep
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.PictureDescription
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepImage
import com.zoonk.android.feature.player.numberAnswerStep
import com.zoonk.android.feature.player.stepResult
import com.zoonk.android.feature.player.summaryStep
import com.zoonk.android.feature.player.typedAnswerStep
import com.zoonk.android.feature.player.workedExampleStep
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitPeriod
import com.zoonk.android.ui.components.LimitTier
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.time.Instant

private val STARTED_AT = Instant.parse("2026-10-05T10:00:00Z")
private val ANSWERED_AT = Instant.parse("2026-10-05T10:01:00Z")
private val NO_HYPERDRIVE = HyperdriveStart(emptySet(), 0)

private fun play(
    steps: List<LessonStep>,
    vararg actions: LessonAction,
): LessonPlayerState = actions.fold(LessonPlayerState.initial("lesson", steps, now = 0)) { state, action -> reduce(state, action, 0) }

private fun LessonPlayerState.then(action: LessonAction) = reduce(this, action, 0)

private fun answerCheck(
    stepId: String,
    isCorrect: Boolean,
    attemptId: String = "$stepId-attempt",
): Array<LessonAction> =
    arrayOf(
        LessonAction.SelectAnswer(stepId, LessonAnswer.Check(if (isCorrect) "right" else "wrong")),
        LessonAction.CheckResolved(stepId, stepResult(isCorrect, attemptId), counts = true),
    )

private fun started(
    vararg answers: RunAnswer,
    hyperdrive: HyperdriveStart = NO_HYPERDRIVE,
) = LessonAction.RunStarted("run", answers.toList(), hyperdrive, STARTED_AT)

private val LessonPlayerState.currentId get() = currentStep?.id

class LessonPlayerReducerTest {
    @Test
    fun showsTheSampleAnswerOfAnOpenAnswerTheLearnerDoesNotKnowWithoutAVerdict() {
        val steps = listOf(typedAnswerStep("first"), explanationStep("tip"), typedAnswerStep("last"))
        val shown = play(steps, LessonAction.SkipWriting(stepId = "first"))

        assertEquals(LessonPhase.Feedback, shown.phase)
        assertNull(shown.notice)
        assertEquals(listOf("first", "tip", "last"), shown.queue)
        assertEquals(listOf("first"), shown.skippedWritingStepIds)
        assertEquals(emptyMap<String, Boolean>(), shown.firstVerdicts)
        val result = shown.results.getValue("first")
        assertFalse(result.checked)
        assertNull(result.answerText)
        assertEquals("Because it maps chances.", result.correctAnswer)

        val next = shown.then(LessonAction.Continue)
        assertEquals("tip", next.currentId)
        assertEquals(listOf("first", "tip", "last"), next.queue)
    }

    @Test
    fun goesBackOneScreenAtATimeShowingAnAnsweredQuestionsResultAgain() {
        val steps = listOf(checkStep("quiz"), explanationStep("a"), explanationStep("b"))
        val atB = play(steps, *answerCheck("quiz", true), LessonAction.Continue, LessonAction.Continue)
        assertEquals("b", atB.currentId)

        val backToA = atB.then(LessonAction.GoBack)
        assertEquals("a" to LessonPhase.Playing, backToA.currentId to backToA.phase)

        val backToQuiz = backToA.then(LessonAction.GoBack)
        assertEquals(LessonPhase.Feedback, backToQuiz.phase)
        assertEquals(0, backToQuiz.position)
        assertTrue(backToQuiz.reviewing)
        assertEquals(true, backToQuiz.results["quiz"]?.isCorrect)

        assertEquals(0, backToQuiz.then(LessonAction.GoBack).position)

        val forward = backToQuiz.then(LessonAction.Continue)
        assertEquals("a", forward.currentId)
        assertFalse(forward.reviewing)
        assertEquals(mapOf("quiz" to true), forward.firstVerdicts)
    }

    @Test
    fun leavesOutTheRestOfTheWritingAndGoesOnFromWhereTheLearnerIs() {
        val steps = listOf(typedAnswerStep("write-1"), explanationStep("tip"), typedAnswerStep("write-2"), summaryStep("end"))
        val skipped = play(steps, LessonAction.SkipWriting())

        assertEquals(listOf("tip", "end"), skipped.queue)
        assertEquals("tip", skipped.currentId)
        assertEquals(listOf("write-1", "write-2"), skipped.skippedWritingStepIds)
        assertEquals(LessonNotice.WritingSkipped, skipped.notice)
        assertNull(skipped.then(LessonAction.Continue).notice)
    }

    @Test
    fun keepsNumberQuestionsWhenTheRestOfTheWritingIsLeftOut() {
        val skipped = play(listOf(typedAnswerStep("write"), numberAnswerStep("count"), summaryStep("end")), LessonAction.SkipWriting())

        assertEquals(listOf("count", "end"), skipped.queue)
        assertEquals("count", skipped.currentId)
        assertEquals(listOf("write"), skipped.skippedWritingStepIds)
    }

    @Test
    fun putsTheWritingBackWithWriteAgainUntilTheLearnerMovesOn() {
        val steps = listOf(explanationStep("tip"), typedAnswerStep("write"), summaryStep("end"))
        val skipped = play(steps, LessonAction.SkipWriting(opening = true))
        assertEquals(LessonNotice.WritingSkipped, skipped.notice)
        assertEquals(listOf("tip", "end"), skipped.queue)

        val restored = skipped.then(LessonAction.RestoreWriting)
        assertNull(restored.notice)
        assertEquals(0, restored.position)
        assertEquals(listOf("tip", "write", "end"), restored.queue)
        assertEquals(emptyList<String>(), restored.skippedWritingStepIds)

        val movedOn = skipped.then(LessonAction.Continue)
        assertSame(movedOn, movedOn.then(LessonAction.RestoreWriting))
    }

    @Test
    fun keepsTodaysWritingNoticeAndUndoWhenTheRunStartReconcilesStaleProgress() {
        val steps = listOf(checkStep("quiz"), typedAnswerStep("write"), explanationStep("tip"), summaryStep("end"))
        val resumed = play(steps, LessonAction.SkipWriting(opening = true), started(RunAnswer("quiz", true, ANSWERED_AT)))

        assertEquals(LessonNotice.WritingSkipped, resumed.notice)
        assertEquals("tip", resumed.currentId)
        assertEquals(listOf("write"), resumed.skippedWritingStepIds)

        val restored = resumed.then(LessonAction.RestoreWriting)
        assertEquals("write", restored.currentId)
        assertEquals(listOf("quiz", "write", "tip", "end"), restored.queue)
        assertEquals(emptyList<String>(), restored.skippedWritingStepIds)
        assertEquals(mapOf("quiz" to true), restored.firstVerdicts)
        assertEquals("run", (restored.run as LessonRun.Started).runId)
    }

    @Test
    fun bringsTheLearnerBackToTheScreenTheyLeftWithCantWriteNow() {
        val restored =
            play(listOf(typedAnswerStep("write"), explanationStep("tip")), LessonAction.SkipWriting(), LessonAction.RestoreWriting)
        assertEquals("write" to LessonPhase.Playing, restored.currentId to restored.phase)
    }

    @Test
    fun waitsForFinishWhenWritingLeftOutAsTheLessonOpensLeavesNothingToDo() {
        val opened = play(listOf(typedAnswerStep("write")), LessonAction.SkipWriting(opening = true))
        assertEquals(LessonPhase.Completed, opened.phase)
        assertEquals(CompletionStatus.Ready, opened.completion?.status)
    }

    @Test
    fun leavesOutScreensThatCantBePlayedTheOneInViewTooAndKeepsTheOnesBefore() {
        val steps = listOf(explanationStep("tip"), typedAnswerStep("numbered"), explanationStep("next"), summaryStep("end"))
        val left = play(steps, LessonAction.Continue, LessonAction.SkipSteps(listOf("numbered")))

        assertEquals(listOf("tip", "next", "end"), left.queue)
        assertEquals("next", left.currentId)
    }

    @Test
    fun finishesALessonWhoseOnlyScreensLeftWereSkipped() {
        val done = play(listOf(explanationStep("tip"), typedAnswerStep("write")), LessonAction.Continue, LessonAction.SkipWriting())
        assertEquals(LessonPhase.Completed to CompletionStatus.Saving, done.phase to done.completion?.status)
    }

    @Test
    fun keepsWritingSkippedWhenAMissingNonWritingAnswerResyncsTheSameLesson() {
        val steps = listOf(checkStep("quiz"), typedAnswerStep("write"), summaryStep("end"))
        val done = play(steps, *answerCheck("quiz", true), LessonAction.Continue, LessonAction.SkipWriting(), LessonAction.Continue)

        val resumed = done.then(LessonAction.RunResynced(runId = null, answers = emptyList()))
        assertEquals("quiz", resumed.currentId)
        assertEquals(listOf("quiz", "end"), resumed.queue)
        assertEquals(listOf("write"), resumed.skippedWritingStepIds)
    }

    @Test
    fun waitsForFinishWhenTheLastScreenDisappearsWithoutALearnerAction() {
        val done = play(listOf(typedAnswerStep("numbered")), LessonAction.SkipSteps(listOf("numbered")))
        assertEquals(LessonPhase.Completed to CompletionStatus.Ready, done.phase to done.completion?.status)
        assertEquals(CompletionStatus.Saving, done.then(LessonAction.CompletionRetried).completion?.status)
    }

    @Test
    fun opensAnEmptyLessonReadyToFinishWithoutSavingOnEntry() {
        val empty = LessonPlayerState.initial("empty", emptyList(), now = 0)
        assertEquals(LessonPhase.Completed to CompletionStatus.Ready, empty.phase to empty.completion?.status)
    }

    @Test
    fun revealsAWorkedExampleOneStepAtATimeBeforeMovingOn() {
        val steps = listOf(workedExampleStep("worked"), summaryStep("summary"))
        val shown = (0..2).map { count -> play(steps, *Array(count) { LessonAction.Continue }).revealed["worked"] ?: 1 }

        assertEquals(listOf(1, 2, 3), shown)
        assertEquals("summary", play(steps, LessonAction.Continue, LessonAction.Continue, LessonAction.Continue).currentId)
    }

    @Test
    fun showsFeedbackAfterACheckAndCountsOnlyTheFirstVerdict() {
        val state = play(listOf(checkStep("quiz"), summaryStep("s")), *answerCheck("quiz", true))
        assertEquals(LessonPhase.Feedback, state.phase)
        assertEquals(mapOf("quiz" to true), state.firstVerdicts)

        val next = state.then(LessonAction.Continue)
        assertEquals(LessonPhase.Playing to "s", next.phase to next.currentId)
    }

    @Test
    fun sendsAMissedCheckToTheEndOfTheLessonOnceFresh() {
        val steps = listOf(checkStep("quiz"), explanationStep("e"))
        val missed = play(steps, *answerCheck("quiz", false), LessonAction.Continue, LessonAction.Continue)

        assertEquals(listOf("quiz", "e", "quiz"), missed.queue)
        assertEquals("quiz", missed.currentId)
        assertNull(missed.answers["quiz"])
        assertNull(missed.results["quiz"])

        val missedAgain = missed.then(answerCheck("quiz", false)[0]).then(answerCheck("quiz", false)[1])
        assertEquals(listOf("quiz", "e", "quiz"), missedAgain.queue)
        assertEquals(mapOf("quiz" to false), missedAgain.firstVerdicts)

        val done = missedAgain.then(LessonAction.Continue)
        assertEquals(LessonPhase.Completed, done.phase)
        assertEquals(LessonCompletion(CompletionStatus.Saving, testedOut = false), done.completion)
    }

    @Test
    fun letsALanguageAnswerSelfCorrectOnceBeforeTheAnswerShowsCountingTheFirstTry() {
        val wrong = LessonAction.CheckResolved("order", stepResult(false), counts = true)
        val firstTry = play(listOf(fillBlankStep("order"), summaryStep("end")), wrong)

        assertEquals(LessonNotice.SelfCorrect, firstTry.notice)
        assertEquals(LessonPhase.Playing, firstTry.phase)
        assertTrue(firstTry.results.isEmpty())

        val secondTry = firstTry.then(wrong)
        assertNull(secondTry.notice)
        assertEquals(LessonPhase.Feedback, secondTry.phase)
        assertEquals("Right", secondTry.results["order"]?.correctAnswer)
        assertEquals(mapOf("order" to false), secondTry.firstVerdicts)
    }

    @Test
    fun showsAMissedChecksAnswerAtOnceOutsideLanguagePractice() {
        val state = play(listOf(checkStep("quiz"), summaryStep("s")), *answerCheck("quiz", false))
        assertNull(state.notice)
        assertEquals(LessonPhase.Feedback, state.phase)
        assertEquals(false, state.results["quiz"]?.isCorrect)
    }

    @Test
    fun revealsAHooksGuessWithoutCountingIt() {
        val state =
            play(
                listOf(hookGuessStep("hook"), explanationStep("e")),
                LessonAction.SelectAnswer("hook", LessonAnswer.Hook("yes")),
                LessonAction.CheckResolved("hook", stepResult(false), counts = false),
            )

        assertEquals(LessonPhase.Feedback, state.phase)
        assertTrue(state.firstVerdicts.isEmpty())
        assertEquals(listOf("hook", "e"), state.queue)
    }

    @Test
    fun waitsForTheServerOnATypedAnswerAndLetsTheLearnerRetryWhenItFails() {
        val typed = LessonAction.SelectAnswer("typed", LessonAnswer.Typed("A map"))
        val checking = play(listOf(typedAnswerStep("typed")), typed, LessonAction.CheckStarted("typed"))
        assertEquals(LessonPhase.Checking, checking.phase)

        val failed = checking.then(LessonAction.CheckFailed("typed"))
        assertEquals(LessonPhase.Playing, failed.phase)
        assertTrue(failed.checkFailed)
        assertEquals(typed.answer, failed.answers["typed"])

        val graded =
            failed
                .then(
                    LessonAction.CheckStarted("typed"),
                ).then(LessonAction.CheckResolved("typed", stepResult(true), counts = true))
        assertEquals(LessonPhase.Feedback, graded.phase)
        assertFalse(graded.checkFailed)
    }

    @Test
    fun saysWhyAnAnswerWasNotGradedUntilTheNextTry() {
        val guestLimit = CheckIssue.Refused(LessonRefusal.Limited(Limit.Reached(LimitTier.Guest, LimitPeriod.Day)))
        listOf(guestLimit, CheckIssue.NoSpeech).forEach { issue ->
            val refused =
                play(listOf(typedAnswerStep("spoken")), LessonAction.CheckStarted("spoken"), LessonAction.CheckFailed("spoken", issue))
            assertEquals(LessonPhase.Playing, refused.phase)
            assertTrue(refused.checkFailed)
            assertEquals(issue, refused.checkIssue)

            val retried = refused.then(LessonAction.CheckStarted("spoken"))
            assertNull(retried.checkIssue)
            assertNull(retried.then(LessonAction.CheckFailed("spoken")).checkIssue)
        }
    }

    @Test
    fun bringsTheExplanationInFrontOfAQuestionWithExplainFirstAndMarksItHelped() {
        val state =
            play(listOf(checkStep("quiz"), explanationStep("e1"), workedExampleStep("w"), checkStep("quiz2")), LessonAction.ExplainFirst)
        assertEquals(listOf("e1", "w", "quiz", "quiz2"), state.queue)
        assertEquals("e1", state.currentId)
        assertEquals(listOf("quiz"), state.helped)

        val noExplanation = play(listOf(checkStep("quiz"), checkStep("quiz2")), LessonAction.ExplainFirst)
        assertEquals(listOf("quiz", "quiz2"), noExplanation.queue)
    }

    @Test
    fun endsTheLessonWhenIKnowThisGetsEveryCheckRight() {
        val steps = listOf(explanationStep("e"), checkStep("q1"), explanationStep("e2"), checkStep("quiz2"))
        val state =
            play(
                steps,
                LessonAction.KnowThis,
                *answerCheck("q1", true),
                LessonAction.Continue,
                *answerCheck("quiz2", true),
                LessonAction.Continue,
            )

        assertEquals(LessonPhase.Completed, state.phase)
        assertEquals(LessonCompletion(CompletionStatus.Saving, testedOut = true), state.completion)
        assertEquals(mapOf("q1" to true, "quiz2" to true), state.firstVerdicts)
    }

    @Test
    fun returnsToTheLessonWhenIKnowThisMissesACheckWhichComesBackAtTheEnd() {
        val steps = listOf(explanationStep("e"), checkStep("q1"), explanationStep("e2"), checkStep("quiz2"), explanationStep("e3"))
        val quick =
            arrayOf(
                LessonAction.KnowThis,
                *answerCheck("q1", true),
                LessonAction.Continue,
                *answerCheck("quiz2", false),
                LessonAction.Continue,
            )
        val state = play(steps, *quick)

        assertNull(state.notice)
        assertEquals(LessonPhase.Playing, state.phase)
        assertEquals(listOf("e", "e2", "e3", "quiz2"), state.queue)
        assertNull(state.quickCheck)
        assertEquals(listOf("quiz2"), state.retried)
        assertEquals("e", state.currentId)
        assertEquals(mapOf("q1" to true, "quiz2" to false), state.firstVerdicts)

        val retry = play(steps, *quick, LessonAction.Continue, LessonAction.Continue, LessonAction.Continue)
        assertEquals("quiz2", retry.currentId)
        assertNull(retry.quickCheck)
        assertNull(retry.answers["quiz2"])
        assertFalse(retry.screen().canExplainFirst)
    }

    @Test
    fun opensARunTheLearnerComesBackToAtTheFirstScreenStillToAnswer() {
        val steps =
            listOf(
                hookGuessStep("hook"),
                explanationStep("e1"),
                checkStep("q1"),
                explanationStep("e2"),
                checkStep("q2"),
                summaryStep("sum"),
            )
        val resumed = play(steps, started(RunAnswer("q1", false, ANSWERED_AT)))

        assertEquals(mapOf("q1" to false), resumed.firstVerdicts)
        assertEquals(LessonPhase.Playing, resumed.phase)
        assertEquals(listOf("hook", "e1", "q1", "e2", "q2", "sum", "q1"), resumed.queue)
        assertEquals(listOf("q1"), resumed.retried)
        assertEquals("run", (resumed.run as LessonRun.Started).runId)
        assertEquals("e2", resumed.currentId)
    }

    @Test
    fun waitsForADeliberateFinishOnAResumedRunWithEveryScreenAnswered() {
        val steps = listOf(explanationStep("e1"), checkStep("q1"))
        val answer = RunAnswer("q1", true, ANSWERED_AT)
        val done = play(steps, started(answer))

        assertEquals(LessonPhase.Completed to CompletionStatus.Ready, done.phase to done.completion?.status)
        assertEquals(CompletionStatus.Saving, done.then(LessonAction.CompletionRetried).completion?.status)

        val answeredHere = play(steps, LessonAction.Continue, *answerCheck("q1", false), started(answer))
        assertEquals(LessonPhase.Feedback, answeredHere.phase)
        assertEquals(mapOf("q1" to false), answeredHere.firstVerdicts)
    }

    @Test
    fun goesBackToAnAnswerTheServerNeverGotInsteadOfSavingAgainAndAgain() {
        val steps = listOf(explanationStep("e1"), checkStep("q1"), explanationStep("e2"), checkStep("q2"))
        val finished =
            play(
                steps,
                LessonAction.Continue,
                *answerCheck("q1", true),
                LessonAction.Continue,
                LessonAction.Continue,
                *answerCheck("q2", true),
                LessonAction.Continue,
            )
        assertEquals(LessonPhase.Completed, finished.phase)

        val resynced = finished.then(LessonAction.RunResynced(null, listOf(RunAnswer("q1", true, ANSWERED_AT))))
        assertEquals(LessonNotice.AnswerNotSaved, resynced.notice)
        assertEquals(LessonPhase.Playing, resynced.phase)
        assertEquals("e2", resynced.currentId)

        val complete =
            finished.then(LessonAction.RunResynced(null, listOf(RunAnswer("q1", true, ANSWERED_AT), RunAnswer("q2", true, ANSWERED_AT))))
        assertEquals(LessonPhase.Completed to CompletionStatus.Failed, complete.phase to complete.completion?.status)
    }

    @Test
    fun keepsAnswersStillWhileAScreenIsBeingGradedOrAfterTheEnd() {
        val checking = play(listOf(typedAnswerStep("typed")), LessonAction.CheckStarted("typed"))
        assertTrue(checking.then(LessonAction.SelectAnswer("typed", LessonAnswer.Typed("late"))).answers.isEmpty())
    }

    @Test
    fun addsTheServersReviewDateToAVerdictGivenOnTheDevice() {
        val reviewAt = Instant.parse("2026-10-02T00:00:00Z")
        val confirmed =
            play(
                listOf(checkStep("quiz")),
                *answerCheck("quiz", true),
                LessonAction.CheckConfirmed("quiz", "quiz-attempt", reviewAt, false),
            )
        assertEquals(reviewAt, confirmed.results["quiz"]?.nextReviewAt)
    }

    @Test
    fun keepsANewerAnswersVerdictWhenTheServersWordOnAnEarlierAnswerComesLate() {
        val again = play(listOf(checkStep("quiz")), *answerCheck("quiz", true, "first"), *answerCheck("quiz", true, "second"))
        assertEquals("second", again.results["quiz"]?.attemptId)

        val late = again.then(LessonAction.CheckConfirmed("quiz", "first", Instant.parse("2026-10-02T00:00:00Z"), true))
        assertEquals(again.results["quiz"], late.results["quiz"])
    }

    @Test
    fun tracksTheRunAndTheCompletionAsTheServerAnswers() {
        val hyperdrive = HyperdriveStart(emptySet(), 2)
        val done =
            play(
                listOf(explanationStep("e")),
                LessonAction.RunStarting,
                LessonAction.RunStarted("run-1", emptyList(), hyperdrive, STARTED_AT),
                LessonAction.Continue,
                LessonAction.CompletionFailed,
                LessonAction.CompletionRetried,
            )

        assertEquals(LessonRun.Started("run-1", hyperdrive, emptySet()), done.run)
        assertEquals(CompletionStatus.Saving, done.completion?.status)
    }

    @Test
    fun putsTheFirstQuestionBeforeTheExplanationsForASkillTheLearnerAlreadyAnswered() {
        val steps = listOf(hookGuessStep("hook"), explanationStep("e1", "s"), explanationStep("e2", "s"), checkStep("q1", "s"))
        val opening = LessonPlayerState.initial("lesson", steps, LessonSupport.QuestionFirst, now = 0)

        assertEquals(listOf("hook", "q1", "e1", "e2"), opening.queue)
        assertEquals(
            listOf("hook", "e1", "e2", "q1"),
            LessonPlayerState.initial("lesson", steps, LessonSupport.ExplanationFirst, now = 0).queue,
        )
    }

    @Test
    fun showsHyperdriveFromThreeNewRightAnswersInARow() {
        val steps = listOf(checkStep("a"), checkStep("b"), checkStep("c"), checkStep("d"))
        val state =
            play(
                steps,
                LessonAction.RunStarted("run", emptyList(), HyperdriveStart(setOf("b"), 1), STARTED_AT),
                *answerCheck("a", true),
                LessonAction.Continue,
                *answerCheck("b", true),
                LessonAction.Continue,
                *answerCheck("c", true),
            )

        assertEquals(3, state.screen().hyperdriveStreak)
        assertNull(state.hyperdriveStreak("b"))
    }

    @Test
    fun offersTheBuddyAfterTwoMissesOnOneIdeaWithTheExplanationTheyRestOn() {
        val steps = listOf(explanationStep("e", "s"), checkStep("q1", "s"), checkStep("q2", "s"))
        val state =
            play(
                steps,
                LessonAction.Continue,
                *answerCheck("q1", false),
                LessonAction.Continue,
                *answerCheck("q2", false),
            )

        assertEquals("e", state.screen().struggleOffer?.id)
        assertNull(play(steps, LessonAction.Continue, *answerCheck("q1", false)).screen().struggleOffer)
    }

    @Test
    fun aQuestionWaitsForItsPictureAndPlaysOnceItComes() {
        val drawing = numberedCheckStep("parts").copy(imagePending = true, pictureWaitStartedAt = 0)
        val waiting = play(listOf(drawing, summaryStep("end")), started(), LessonAction.SelectAnswer("parts", LessonAnswer.Check("right")))

        assertEquals(false, waiting.screen().primary?.enabled)

        val drawn = waiting.then(LessonAction.PicturesRead(listOf(numberedCheckStep("parts").copy(image = PICTURE)), openedAt = 0))

        assertEquals(PICTURE, drawn.currentStep?.image)
        assertEquals(true, drawn.screen().primary?.enabled)
    }

    @Test
    fun aNumberedPictureQuestionWhosePictureNeverCameIsLeftOut() {
        val drawing = numberedCheckStep("parts").copy(imagePending = true, pictureWaitStartedAt = 0)
        val opened = play(listOf(explanationStep("idea"), drawing, summaryStep("end")), started())

        val stillWaiting = reduce(opened, LessonAction.PicturesRead(emptyList(), openedAt = 0), 60_000)
        assertEquals(listOf("idea", "parts", "end"), stillWaiting.queue)

        val waitOver = reduce(opened, LessonAction.PicturesRead(emptyList(), openedAt = 0), 300_000)
        assertEquals(listOf("idea", "end"), waitOver.queue)
    }
}

private val PICTURE = StepImage("picture", "https://api.zoonk.test/v1/files/picture", "A cell", 800, 1000)

private fun numberedCheckStep(id: String): LessonStep {
    val check = checkStep(id)
    val content = (check.content as StepContent.Check).content
    return check.copy(
        content =
            StepContent.Check(
                content.copy(image = PictureDescription(alt = "A cell", prompt = "A cell", parts = listOf("Nucleus", "Wall"))),
            ),
    )
}
