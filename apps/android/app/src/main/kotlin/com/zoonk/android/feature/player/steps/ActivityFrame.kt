package com.zoonk.android.feature.player.steps

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityPhase
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.beforeAfterRenderer
import com.zoonk.android.feature.activities.chartReaderRenderer
import com.zoonk.android.feature.activities.choiceAnswer
import com.zoonk.android.feature.activities.choiceId
import com.zoonk.android.feature.activities.code.codeRunnerRenderer
import com.zoonk.android.feature.activities.code.codeTracerRenderer
import com.zoonk.android.feature.activities.code.patternTesterRenderer
import com.zoonk.android.feature.activities.code.sqlPlaygroundRenderer
import com.zoonk.android.feature.activities.decisionTreeRenderer
import com.zoonk.android.feature.activities.dialogueSimulatorRenderer
import com.zoonk.android.feature.activities.findErrorRenderer
import com.zoonk.android.feature.activities.guessRevealRenderer
import com.zoonk.android.feature.activities.numericAnswer
import com.zoonk.android.feature.activities.numericValue
import com.zoonk.android.feature.activities.patternTableRenderer
import com.zoonk.android.feature.activities.sorting.categorizeRenderer
import com.zoonk.android.feature.activities.sorting.processOrderRenderer
import com.zoonk.android.feature.activities.stepSolverRenderer
import com.zoonk.android.feature.player.engine.LessonPhase
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.android.feature.player.model.ActivityCheck
import com.zoonk.android.feature.player.model.ActivityFrame
import com.zoonk.android.feature.player.model.ActivityStepContent
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.NumericCheck
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepResult
import com.zoonk.android.ui.components.FeedbackPanel
import com.zoonk.android.ui.components.FeedbackTone
import com.zoonk.android.ui.components.FeedbackVerdict
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.components.PictureFrame
import com.zoonk.android.ui.format.currencyFor
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.exactFractionDigitsFor
import com.zoonk.android.ui.format.formatAmount
import com.zoonk.android.ui.format.formatMoney
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.parseLocalizedNumber
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.ApiJson
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheckOneOf2Tolerance
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlin.math.abs
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOf1Value as InteractionCheckValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOf2Value as NumericCheckValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOfValue as ChoiceCheckValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfData.PlayableLibraryStepAnyOfContentOneOfDataAnyOf1Value as SourcedDataValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfData.PlayableLibraryStepAnyOfContentOneOfDataAnyOfValue as ExampleDataValue

/** The one place a template gets its renderer. */
val activityRenderers: Map<String, ActivityRenderer> =
    mapOf(
        "beforeAfter" to beforeAfterRenderer,
        "categorize" to categorizeRenderer,
        "chartReader" to chartReaderRenderer,
        "codeRunner" to codeRunnerRenderer,
        "codeTracer" to codeTracerRenderer,
        "decisionTree" to decisionTreeRenderer,
        "dialogueSimulator" to dialogueSimulatorRenderer,
        "findError" to findErrorRenderer,
        "guessReveal" to guessRevealRenderer,
        "patternTable" to patternTableRenderer,
        "patternTester" to patternTesterRenderer,
        "processOrder" to processOrderRenderer,
        "sqlPlayground" to sqlPlaygroundRenderer,
        "stepSolver" to stepSolverRenderer,
    )

private val KeptAnswer: Saver<ActivityAnswer?, String> =
    Saver(save = { answer -> answer?.let { ApiJson.encodeToString(it) } }, restore = { ApiJson.decodeFromString(it) })

/** Apple's rule: a choice or number check can be answered from the frame alone; an interaction needs its canvas. */
val StepContent.Activity.isPlayable: Boolean
    get() = frame.check !is InteractionCheckValue || frame.template in activityRenderers

/** Main's `ActivityStep`: the badge and prompt, the picture, the check and the template's canvas, then its own feedback. */
@Composable
internal fun ActivityView(
    step: LessonStep,
    content: StepContent.Activity,
    answer: LessonAnswer?,
    result: StepResult?,
    state: LessonPlayerState,
    actions: StepActions,
) {
    val frame = content.frame
    val renderer = activityRenderers[frame.template]
    val phase = if (result == null) ActivityPhase.Answering else ActivityPhase.Checked
    val activityAnswer = (answer as? LessonAnswer.Activity)?.answer
    val locked = state.phase != LessonPhase.Playing
    var kept by rememberSaveable(step.id, stateSaver = KeptAnswer) { mutableStateOf<ActivityAnswer?>(null) }
    val onAnswerChange = { next: ActivityAnswer? ->
        if (!locked) {
            kept = next
            actions.select(next?.let(LessonAnswer::Activity))
        }
    }
    // After Android closes the app in the background, a canvas gets its saved work back but the player doesn't get its answer.
    LaunchedEffect(step.id) { if (activityAnswer == null && result == null) kept?.let(onAnswerChange) }
    val shownAnswer = activityAnswer ?: kept.takeIf { result == null }
    val checkFirst = renderer?.checkFirst?.invoke(content.content) == true
    val check = @Composable { ActivityCheckArea(frame.check, shownAnswer, phase, locked, onAnswerChange) }

    QuestionScene {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            renderer?.badge?.invoke(content.content)?.let { LabelChip(stringResource(it.label), icon = it.icon) }
            QuestionText(frame.prompt, answered = result != null)
        }
        StepPicture(step, PictureFrame.Question)

        if (checkFirst) check()
        renderer?.let {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                it.canvas(
                    ActivityProps(content.content, shownAnswer, result?.expected, result?.isCorrect, phase, locked, onAnswerChange),
                )
                if (it.showsData(content.content)) ActivityDataNote(frame)
            }
        }
        if (!checkFirst) check()

        if (result != null) ActivityFeedback(frame.check, activityAnswer, result.isCorrect)
    }
}

@Composable
private fun ActivityCheckArea(
    check: ActivityCheck,
    answer: ActivityAnswer?,
    phase: ActivityPhase,
    locked: Boolean,
    onAnswerChange: (ActivityAnswer?) -> Unit,
) {
    if (check is ChoiceCheckValue) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            CheckQuestion(check.value.question)
            ChoiceOptions(
                options = check.value.options.map { ChoiceOption(it.id, it.text, it.isCorrect) },
                selectedId = answer.choiceId,
                isChecked = phase == ActivityPhase.Checked,
                isGuess = false,
                locked = locked,
                onSelect = { id -> onAnswerChange(id?.let { choiceAnswer(it) }) },
            )
        }
    } else if (check is NumericCheckValue) {
        NumericCheckField(check.value, answer, locked, onAnswerChange)
    }
}

@Composable
private fun CheckQuestion(text: String) {
    RichText(text = text, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold))
}

/** Main's `ActivityNumericCheck`: the learner's own typing stays as typed; money keeps its sign where the language writes it. */
@Composable
private fun NumericCheckField(
    check: NumericCheck,
    answer: ActivityAnswer?,
    locked: Boolean,
    onAnswerChange: (ActivityAnswer?) -> Unit,
) {
    val locale = currentLocale()
    var typed by rememberSaveable { mutableStateOf<String?>(null) }
    val value = answer.numericValue
    val shown =
        typed?.takeIf { parseLocalizedNumber(it, locale) == value }
            ?: value?.let { formatNumber(it, locale, exactFractionDigitsFor(check.answer, check.allowed, it), grouping = false) }
            ?: typed.orEmpty()
    val unit = check.unit
    val currency = currencyFor(unit)
    val unitFirst = currency != null && formatMoney(1.0, currency, locale).indexOfFirst(Char::isDigit) > 0

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        CheckQuestion(check.question)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (unitFirst) UnitText(unit.orEmpty())
            OutlinedTextField(
                value = shown,
                onValueChange = { text ->
                    typed = text
                    onAnswerChange(
                        parseLocalizedNumber(text, locale)?.let {
                            numericAnswer(it)
                        },
                    )
                },
                modifier = Modifier.widthIn(min = 160.dp, max = 240.dp),
                readOnly = locked,
                placeholder = { Text(stringResource(R.string.player_your_answer)) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                textStyle = MaterialTheme.typography.bodyLarge.withTabularFigures(),
            )
            if (unit != null && !unitFirst) UnitText(unit)
        }
    }
}

@Composable
private fun UnitText(unit: String) {
    Text(unit, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
}

/** The difference a numeric answer may have from the expected one and still be right. */
internal val NumericCheck.allowed: Double
    get() =
        when (tolerance.kind) {
            PlayableLibraryStepAnyOfContentOneOfCheckOneOf2Tolerance.Kind.ABSOLUTE -> tolerance.`value`
            PlayableLibraryStepAnyOfContentOneOfCheckOneOf2Tolerance.Kind.RELATIVE -> tolerance.`value` * abs(answer)
        }

/** Main's `ActivityDataNote`: made-up numbers say so; real ones name their source, linked when it has an address. */
@Composable
private fun ActivityDataNote(frame: ActivityFrame) {
    val data = frame.data ?: return
    val style = MaterialTheme.typography.bodySmall
    val color = MaterialTheme.colorScheme.onSurfaceVariant

    when (data) {
        is ExampleDataValue -> {
            Text(stringResource(R.string.player_activity_example_data), color = color, style = style)
        }

        is SourcedDataValue -> {
            val source = data.value.source
            val details = listOfNotNull(source.publisher, source.year?.toString()).joinToString(", ")
            val name = if (details.isEmpty()) source.title else "${source.title} ($details)"
            val label = stringResource(R.string.player_activity_source, name)
            val url = source.url?.toString()
            val start = label.indexOf(name)

            Text(
                text =
                    buildAnnotatedString {
                        if (url == null || start < 0) {
                            append(label)
                        } else {
                            append(label.substring(0, start))
                            withLink(
                                LinkAnnotation.Url(url, TextLinkStyles(SpanStyle(textDecoration = TextDecoration.Underline))),
                            ) { append(name) }
                            append(label.substring(start + name.length))
                        }
                    },
                color = color,
                style = style,
            )
        }
    }
}

/** Main's `ActivityFeedback`: the verdict, then the check's own reasons, numbers or explanation. */
@Composable
private fun ActivityFeedback(
    check: ActivityCheck,
    answer: ActivityAnswer?,
    isCorrect: Boolean,
) {
    FeedbackPanel(label = stringResource(R.string.player_answer_feedback)) {
        FeedbackVerdict(
            text = stringResource(if (isCorrect) R.string.player_verdict_correct else R.string.player_verdict_incorrect),
            tone = if (isCorrect) FeedbackTone.Right else FeedbackTone.Wrong,
        )

        when (check) {
            is ChoiceCheckValue -> {
                val options = check.value.options
                val chosenId = answer.choiceId
                val chosen = options.firstOrNull { it.id == chosenId }
                val correct = options.firstOrNull { it.isCorrect }

                chosen?.let { FeedbackText(it.reason) }
                if (correct != null && chosen?.isCorrect != true) {
                    LabeledLine(stringResource(R.string.player_activity_correct_answer), correct.text)
                    FeedbackText(correct.reason)
                }
            }

            is NumericCheckValue -> {
                val numeric = check.value
                val locale = currentLocale()
                val value = answer.numericValue
                val digits = exactFractionDigitsFor(numeric.answer, numeric.allowed, value ?: numeric.answer)

                value?.let {
                    LabeledLine(
                        stringResource(R.string.player_activity_your_answer),
                        formatAmount(it, locale, numeric.unit, maximumFractionDigits = digits),
                        tabular = true,
                        isRight = false,
                    )
                }
                if (!isCorrect) {
                    LabeledLine(
                        stringResource(R.string.player_correct_answer_label),
                        formatAmount(numeric.answer, locale, numeric.unit, maximumFractionDigits = digits),
                        tabular = true,
                    )
                }
                FeedbackText(numeric.explanation)
            }

            is InteractionCheckValue -> {
                FeedbackText(check.value.explanation)
            }
        }
    }
}

@Composable
private fun FeedbackText(text: String) {
    RichText(text = text, style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun LabeledLine(
    label: String,
    answer: String,
    tabular: Boolean = false,
    isRight: Boolean = true,
) {
    val style = MaterialTheme.typography.bodyMedium
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = style)
        Text(
            answer,
            color = if (isRight) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.onSurface,
            style = (if (tabular) style.withTabularFigures() else style).copy(fontWeight = FontWeight.Medium),
        )
    }
}
