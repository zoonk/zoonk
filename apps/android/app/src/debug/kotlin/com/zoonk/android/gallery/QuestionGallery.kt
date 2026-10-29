package com.zoonk.android.gallery

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.zoonk.android.feature.questions.Answer
import com.zoonk.android.feature.questions.AnswerCheck
import com.zoonk.android.feature.questions.AnswerFeedback
import com.zoonk.android.feature.questions.Citation
import com.zoonk.android.feature.questions.Drill
import com.zoonk.android.feature.questions.DrillAnswerNotes
import com.zoonk.android.feature.questions.DrillCountdown
import com.zoonk.android.feature.questions.DrillIdeas
import com.zoonk.android.feature.questions.DrillNote
import com.zoonk.android.feature.questions.ItemSet
import com.zoonk.android.feature.questions.ItemSetText
import com.zoonk.android.feature.questions.ItemSupport
import com.zoonk.android.feature.questions.NumericEntry
import com.zoonk.android.feature.questions.NumericUnit
import com.zoonk.android.feature.questions.PlacementNote
import com.zoonk.android.feature.questions.Question
import com.zoonk.android.feature.questions.QuestionAnswer
import com.zoonk.android.feature.questions.QuestionFeedback
import com.zoonk.android.feature.questions.QuestionFormat
import com.zoonk.android.feature.questions.QuestionTitle
import com.zoonk.android.feature.questions.QuotedSource
import com.zoonk.android.feature.questions.Select
import com.zoonk.android.feature.questions.TrueFalseWords

private val choice =
    Question(
        itemId = "choice",
        format = QuestionFormat.MultipleChoice,
        question = "Which organelle makes most of a cell's **energy**?",
        options = listOf("Ribosome", "Mitochondria", "Golgi apparatus", "Nucleus"),
    )

private val severalPicks =
    choice.copy(
        itemId = "several",
        question = "Which of these are prime numbers?",
        options = listOf("2", "9", "11", "15"),
        select = Select.Count(2),
    )

private val statement =
    Question(itemId = "statement", format = QuestionFormat.TrueFalse, question = "The Treaty of Tordesillas was signed in 1494.")

private val order =
    Question(
        itemId = "order",
        format = QuestionFormat.Order,
        question = "Put the steps of mitosis in order.",
        options = listOf("Metaphase", "Prophase", "Telophase", "Anaphase"),
    )

private val pairs =
    Question(
        itemId = "pairs",
        format = QuestionFormat.MatchPairs,
        question = "Match each capital to its country.",
        left = listOf("Lisbon", "Lima", "Canberra"),
        right = listOf("Australia", "Portugal", "Peru"),
    )

private val numeric =
    Question(
        itemId = "numeric",
        format = QuestionFormat.Numeric,
        question = "A shirt costs R$ 80 and is 15% off. How much do you pay?",
        entry = NumericEntry(NumericEntry.Kind.Decimals, places = 2),
        unit = NumericUnit(NumericUnit.Position.Prefix, "R$"),
        context = "| Item | Price |\n| --- | ---: |\n| Shirt | R$ 80 |\n| Discount | 15% |",
    )

private val typed = Question(itemId = "typed", format = QuestionFormat.Typed, question = "What's the chemical symbol for sodium?")

private val citation =
    Citation(
        text = "ENEM 2023",
        title = "ENEM 2023, first day",
        publisher = "INEP",
        url = "https://www.gov.br/inep",
        checkedAt = "2026-10-01T00:00:00Z",
    )

private val longText =
    "Recife's tides shaped where the city grew. ".repeat(14) +
        "Merchants built along the river, and the port's warehouses still stand where the water once reached."

private val drill =
    Drill(
        Drill.Kind.Reteach,
        Drill.Lesson("lesson", "Cell energy", listOf("Mitochondria turn glucose into ATP.", "ATP carries energy around the cell.")),
    )

@Composable
internal fun QuestionChoices() {
    Samples {
        Sample(choice) { QuestionAnswer(choice, TrueFalseWords.TrueFalse, false, null, true, {}, {}) }
        Sample(severalPicks) { QuestionAnswer(severalPicks, TrueFalseWords.TrueFalse, false, null, true, {}, {}) }
        Sample(choice.copy(itemId = "checked"), graded = true) {
            QuestionAnswer(choice, TrueFalseWords.TrueFalse, false, AnswerCheck(Answer.Choice(0), Answer.Choice(1), false), false, {}, {})
        }
    }
}

@Composable
internal fun QuestionStatements() {
    Samples {
        key("blank") {
            QuestionAnswer(
                statement,
                TrueFalseWords.RightWrong,
                allowBlank = true,
                check = null,
                enabled = true,
                onAnswer = {},
                onSubmit = {},
            )
        }
        key("checked") {
            QuestionAnswer(
                statement,
                TrueFalseWords.TrueFalse,
                false,
                AnswerCheck(
                    Answer.TrueFalse(false),
                    Answer.TrueFalse(true),
                    false,
                ),
                false,
                {
                },
                {},
            )
        }
    }
}

@Composable
internal fun QuestionOrderAndPairs() {
    Samples {
        Sample(order) { QuestionAnswer(order, TrueFalseWords.TrueFalse, false, null, true, {}, {}) }
        Sample(order.copy(itemId = "order-checked"), graded = true) {
            QuestionAnswer(
                order,
                TrueFalseWords.TrueFalse,
                false,
                AnswerCheck(
                    Answer.Order(listOf(1, 0, 2, 3)),
                    Answer.Order(listOf(1, 0, 3, 2)),
                    false,
                ),
                false,
                {
                },
                {},
            )
        }
        Sample(pairs) { QuestionAnswer(pairs, TrueFalseWords.TrueFalse, false, null, true, {}, {}) }
    }
}

@Composable
internal fun QuestionFields() {
    Samples {
        Sample(numeric) { QuestionAnswer(numeric, TrueFalseWords.TrueFalse, false, null, true, {}, {}) }
        Sample(numeric.copy(itemId = "numeric-checked"), graded = true) {
            QuestionAnswer(numeric, TrueFalseWords.TrueFalse, false, AnswerCheck(Answer.Numeric(68.0), null, true), false, {}, {})
        }
        Sample(typed) { QuestionAnswer(typed, TrueFalseWords.TrueFalse, false, null, true, {}, {}) }
        Sample(typed.copy(itemId = "typed-checked"), graded = true) {
            QuestionAnswer(typed, TrueFalseWords.TrueFalse, false, AnswerCheck(Answer.Text("So"), Answer.Text("Na"), false), false, {}, {})
        }
    }
}

@Composable
internal fun QuestionFeedbacks() {
    Samples {
        QuestionFeedback(
            question = numeric.copy(citation = citation),
            answer = Answer.Numeric(64.0),
            feedback =
                AnswerFeedback(
                    isCorrect = false,
                    correctAnswer = Answer.Numeric(68.0),
                    explanation = "15% of R$ 80 is R$ 12, so you pay **R$ 68**.",
                    workedSteps = listOf("0.15 × 80 = 12", "80 − 12 = 68"),
                    savedToNotebook = true,
                ),
            words = TrueFalseWords.TrueFalse,
            examTomorrow = false,
            timedOut = false,
        ) { DrillAnswerNotes(drill = null, notSure = false, timedOut = false, trap = "15% off isn't 15 reais off.") }
        QuestionFeedback(
            question = choice,
            answer = Answer.Choice(1),
            feedback = AnswerFeedback(isCorrect = true, hyperdrive = AnswerFeedback.Hyperdrive(4), mistakeFixed = true),
            words = TrueFalseWords.TrueFalse,
            examTomorrow = false,
            timedOut = false,
        )
        QuestionFeedback(
            question = statement,
            answer = Answer.DontKnow,
            feedback = AnswerFeedback(isCorrect = false, blank = true),
            words = TrueFalseWords.RightWrong,
            examTomorrow = false,
            timedOut = false,
        )
    }
}

@Composable
internal fun QuestionMaterials() {
    Samples {
        PlacementNote()
        QuotedSource(citation)
        ItemSupport(numeric)
        ItemSetText(
            ItemSet(
                id = "set",
                kind = ItemSet.Kind.Text,
                count = 3,
                position = 1,
                title = "The port of Recife",
                text = longText,
                source = "Adapted from IBGE",
            ),
            continued = true,
        )
    }
}

@Composable
internal fun QuestionDrills() {
    Samples {
        DrillNote(Drill(Drill.Kind.Timed, timeLimitSeconds = 45), onOpenLesson = null)
        key("full") { DrillCountdown(seconds = 45, onTimeUp = {}) }
        key("ending") { DrillCountdown(seconds = 8, onTimeUp = {}) }
        DrillAnswerNotes(drill = Drill(Drill.Kind.NoGuessing), notSure = true, timedOut = true, trap = null)
        DrillNote(Drill(Drill.Kind.Retry), onOpenLesson = null, lastAnswer = "Ribosome")
        DrillNote(drill.copy(lesson = drill.lesson?.copy(ideas = emptyList())), onOpenLesson = {})
        DrillIdeas(drill, onOpenLesson = {})
    }
}

@Composable
private fun Samples(content: @Composable () -> Unit) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(28.dp)) { content() }
}

@Composable
private fun Sample(
    question: Question,
    graded: Boolean = false,
    answer: @Composable () -> Unit,
) {
    key(question.itemId) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            ItemSupport(question.copy(context = null))
            QuestionTitle(question.question, graded = graded)
            answer()
        }
    }
}
