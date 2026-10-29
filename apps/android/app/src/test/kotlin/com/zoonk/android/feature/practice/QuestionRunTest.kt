package com.zoonk.android.feature.practice

import com.zoonk.android.feature.practice.block.BlockPhase
import com.zoonk.android.feature.practice.block.BlockRun
import com.zoonk.android.feature.practice.block.DrillStage
import com.zoonk.android.feature.practice.block.NetTally
import com.zoonk.android.feature.practice.block.Segment
import com.zoonk.android.feature.practice.block.netTally
import com.zoonk.android.feature.practice.block.segments
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.AnswerFeedback
import com.zoonk.android.feature.questions.AnsweredMark
import com.zoonk.android.feature.questions.Drill
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.QuestionFormat
import org.junit.Assert.assertEquals
import org.junit.Test

class BlockRunTest {
    private fun question(
        id: String,
        answered: AnsweredMark? = null,
        drill: Drill? = null,
        mistakeId: String? = null,
        placement: Boolean = false,
    ) = Question(
        id,
        QuestionFormat.MultipleChoice,
        "Q$id",
        options = listOf("a", "b"),
        answered = answered,
        drill = drill,
        mistakeId = mistakeId,
        placement = placement,
    )

    @Test
    fun resumesAtTheFirstUnansweredQuestionAndWaitsForFinishWhenAllAreAnswered() {
        val questions = listOf(question("1", AnsweredMark(true)), question("2"), question("3"))
        assertEquals(1, BlockRun.begin(questions).index)
        assertEquals(BlockPhase.Answering, BlockRun.begin(questions).phase)

        val answered = questions.map { it.copy(answered = AnsweredMark(false)) }
        assertEquals(BlockPhase.FinishReady, BlockRun.begin(answered).phase)
    }

    @Test
    fun aMistakesIdeasComeFirstOnlyOnItsFirstQuestion() {
        val reteach = Drill(Drill.Kind.Reteach, Drill.Lesson("l", "Cells", listOf("ATP")))
        val questions = listOf(question("1", drill = reteach, mistakeId = "m"), question("2", drill = reteach, mistakeId = "m"))

        val run = BlockRun.begin(questions)
        assertEquals(DrillStage.Ideas, run.stage)
        assertEquals(DrillStage.Open, run.start(questions).stage)

        val second = run.start(questions).answered("1", Answer.Choice(0), AnswerFeedback(isCorrect = true)).next(questions)
        assertEquals(DrillStage.Open, second.stage)
    }

    @Test
    fun aReadCarefullyDrillShowsTheQuestionBeforeItsAnswers() {
        val questions = listOf(question("1", drill = Drill(Drill.Kind.ReadCarefully)))
        val run = BlockRun.begin(questions)
        assertEquals(DrillStage.Reading, run.stage)
        assertEquals(DrillStage.Open, run.reveal().stage)
    }

    @Test
    fun movingPastTheLastQuestionFinishes() {
        val questions = listOf(question("1"))
        val run = BlockRun.begin(questions).answered("1", Answer.Choice(1), AnswerFeedback(isCorrect = false)).next(questions)
        assertEquals(BlockPhase.Finishing, run.phase)
    }

    @Test
    fun segmentsReadAPlacementOrABlankAsNeitherRightNorWrong() {
        val questions = listOf(question("1"), question("2", placement = true), question("3"), question("4"), question("5"))
        val run =
            BlockRun
                .begin(questions)
                .answered("1", Answer.Choice(0), AnswerFeedback(isCorrect = true))
                .next(questions)
                .answered("2", Answer.DontKnow, AnswerFeedback(isCorrect = false))
                .next(questions)
                .answered("3", Answer.DontKnow, AnswerFeedback(isCorrect = false, blank = true))
                .next(questions)

        assertEquals(listOf(Segment.Right, Segment.Read, Segment.Read, Segment.Current, Segment.Ahead), segments(questions, run))
    }

    @Test
    fun theNetTallyCountsThisVisitAndAnEarlierOnesBlanksAsNeither() {
        val questions =
            listOf(question("1", AnsweredMark(false, blank = true)), question("2", AnsweredMark(true)), question("3"), question("4"))
        val run =
            BlockRun
                .begin(questions)
                .answered("3", Answer.TrueFalse(true), AnswerFeedback(isCorrect = false))

        assertEquals(NetTally(right = 1, wrong = 1), netTally(questions, run))
    }
}
