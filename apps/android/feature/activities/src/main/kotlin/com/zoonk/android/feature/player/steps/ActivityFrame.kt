package com.zoonk.android.feature.player.steps

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
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
import com.zoonk.android.feature.activities.canvasOwnsAnswer
import com.zoonk.android.feature.activities.chartReaderRenderer
import com.zoonk.android.feature.activities.choiceAnswer
import com.zoonk.android.feature.activities.choiceId
import com.zoonk.android.feature.activities.code.codeRunnerRenderer
import com.zoonk.android.feature.activities.code.codeTracerRenderer
import com.zoonk.android.feature.activities.code.patternTesterRenderer
import com.zoonk.android.feature.activities.code.sqlPlaygroundRenderer
import com.zoonk.android.feature.activities.dialogueSimulatorRenderer
import com.zoonk.android.feature.activities.findErrorRenderer
import com.zoonk.android.feature.activities.geometry.geometryBoardRenderer
import com.zoonk.android.feature.activities.geometry.lineCrossingRenderer
import com.zoonk.android.feature.activities.geometry.moleculeBuilderRenderer
import com.zoonk.android.feature.activities.geometry.unitCircleRenderer
import com.zoonk.android.feature.activities.guessRevealRenderer
import com.zoonk.android.feature.activities.math.areaModelRenderer
import com.zoonk.android.feature.activities.math.balanceRenderer
import com.zoonk.android.feature.activities.math.distributionExplorerRenderer
import com.zoonk.android.feature.activities.math.formulaModelRenderer
import com.zoonk.android.feature.activities.math.numberLineRenderer
import com.zoonk.android.feature.activities.math.randomSimulationRenderer
import com.zoonk.android.feature.activities.music.keyboardFretboardRenderer
import com.zoonk.android.feature.activities.music.notationPlayerRenderer
import com.zoonk.android.feature.activities.music.rhythmTapperRenderer
import com.zoonk.android.feature.activities.numericAnswer
import com.zoonk.android.feature.activities.numericValue
import com.zoonk.android.feature.activities.patternTableRenderer
import com.zoonk.android.feature.activities.reasoning.argumentBuilderRenderer
import com.zoonk.android.feature.activities.reasoning.combinationGridRenderer
import com.zoonk.android.feature.activities.reasoning.mapExplorerRenderer
import com.zoonk.android.feature.activities.reasoning.sourceComparisonRenderer
import com.zoonk.android.feature.activities.sorting.categorizeRenderer
import com.zoonk.android.feature.activities.sorting.causeEffectChainRenderer
import com.zoonk.android.feature.activities.sorting.labeledDiagramRenderer
import com.zoonk.android.feature.activities.sorting.matchPairsRenderer
import com.zoonk.android.feature.activities.sorting.processOrderRenderer
import com.zoonk.android.feature.activities.sorting.timelineRenderer
import com.zoonk.android.feature.activities.stepSolverRenderer
import com.zoonk.android.feature.player.LocalFeedbackReveal
import com.zoonk.android.feature.player.RevealPart
import com.zoonk.android.feature.player.engine.LessonPhase
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.isRequiredPictureDrawing
import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.android.feature.player.model.ActivityCheck
import com.zoonk.android.feature.player.model.ActivityFrame
import com.zoonk.android.feature.player.model.ActivityStepContent
import com.zoonk.android.feature.player.model.ActivityTolerance
import com.zoonk.android.feature.player.model.ExploredActivity
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.NumericCheck
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepResult
import com.zoonk.android.feature.player.revealPart
import com.zoonk.android.feature.questions.decimalEntryRule
import com.zoonk.android.ui.components.Eyebrow
import com.zoonk.android.ui.components.FeedbackPanel
import com.zoonk.android.ui.components.FeedbackTone
import com.zoonk.android.ui.components.FeedbackVerdict
import com.zoonk.android.ui.components.OutlinedTextField
import com.zoonk.android.ui.components.PictureFrame
import com.zoonk.android.ui.format.currencyUnit
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.exactFractionDigitsFor
import com.zoonk.android.ui.format.formatAmount
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.parseLocalizedNumber
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.ActivityExpectedFormulaTolerance
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.pow
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf5Value as GuessRevealContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOf1Value as InteractionCheckValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOf2Value as NumericCheckValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOfValue as ChoiceCheckValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfData.PlayableLibraryStepAnyOfContentOneOfDataAnyOf1Value as SourcedDataValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfData.PlayableLibraryStepAnyOfContentOneOfDataAnyOfValue as ExampleDataValue

/** The one place a template gets its renderer. */
val activityRenderers: Map<String, ActivityRenderer> =
    mapOf(
        "areaModel" to areaModelRenderer,
        "argumentBuilder" to argumentBuilderRenderer,
        "balance" to balanceRenderer,
        "beforeAfter" to beforeAfterRenderer,
        "categorize" to categorizeRenderer,
        "causeEffectChain" to causeEffectChainRenderer,
        "chartReader" to chartReaderRenderer,
        "codeRunner" to codeRunnerRenderer,
        "codeTracer" to codeTracerRenderer,
        "combinationGrid" to combinationGridRenderer,
        "dialogueSimulator" to dialogueSimulatorRenderer,
        "distributionExplorer" to distributionExplorerRenderer,
        "findError" to findErrorRenderer,
        "formulaModel" to formulaModelRenderer,
        "geometryBoard" to geometryBoardRenderer,
        "guessReveal" to guessRevealRenderer,
        "keyboardFretboard" to keyboardFretboardRenderer,
        "labeledDiagram" to labeledDiagramRenderer,
        "lineCrossing" to lineCrossingRenderer,
        "mapExplorer" to mapExplorerRenderer,
        "matchPairs" to matchPairsRenderer,
        "moleculeBuilder" to moleculeBuilderRenderer,
        "notationPlayer" to notationPlayerRenderer,
        "numberLine" to numberLineRenderer,
        "patternTable" to patternTableRenderer,
        "patternTester" to patternTesterRenderer,
        "processOrder" to processOrderRenderer,
        "randomSimulation" to randomSimulationRenderer,
        "rhythmTapper" to rhythmTapperRenderer,
        "sourceComparison" to sourceComparisonRenderer,
        "sqlPlayground" to sqlPlaygroundRenderer,
        "stepSolver" to stepSolverRenderer,
        "timeline" to timelineRenderer,
        "unitCircle" to unitCircleRenderer,
    )

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
    part: StepPart,
) {
    val frame = content.frame
    val renderer = activityRenderers[frame.template]
    val phase = if (result == null) ActivityPhase.Answering else ActivityPhase.Checked
    val activityAnswer = (answer as? LessonAnswer.Activity)?.answer
    val locked = state.phase != LessonPhase.Playing || step.isRequiredPictureDrawing
    val onAnswerChange = { next: ActivityAnswer? -> if (!locked) actions.select(next?.let(LessonAnswer::Activity)) }
    val checkFirst = renderer?.checkFirst?.invoke(content.content) == true
    val ownsAnswer = canvasOwnsAnswer(frame.template)
    val places = (frame.check as? NumericCheckValue)?.value?.decimalPlaces(content.minTolerance)
    val numericQuestion =
        (frame.check as? NumericCheckValue)?.value?.question?.takeIf {
            frame.template == "guessReveal" ||
                frame.template == "beforeAfter"
        }
    val check = @Composable {
        if (!ownsAnswer) {
            ActivityCheckArea(
                frame.check,
                activityAnswer,
                phase,
                locked,
                onAnswerChange,
                places,
                numericQuestion != null,
            )
        }
    }
    val props =
        ActivityProps(
            content.content,
            activityAnswer,
            result?.expected,
            result?.isCorrect,
            phase,
            locked,
            onAnswerChange,
            actions.cantListen,
            actions::setCantListen,
            content.baseMap,
            actions::takeNumberKeys,
        )

    // On a spread, a canvas the question asks about sits under its prompt; an interaction's canvas is the answer, so it stays
    // with the learner's turn.
    val canvasOnScreen = part != StepPart.Whole && frame.check !is InteractionCheckValue && !ownsAnswer
    val canvas = @Composable {
        renderer?.let {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ScreenCanvas { it.canvas(props) }
                if (it.showsData(content.content)) ActivityDataNote(frame)
            }
        }
    }

    QuestionScene {
        if (part.showsScreen) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                renderer?.badge?.invoke(content.content)?.let { Eyebrow(stringResource(it.label), icon = it.icon) }
                QuestionText(numericQuestion ?: frame.prompt)
            }
            StepPicture(step, PictureFrame.Question)
            if (canvasOnScreen) canvas()
        }

        if (part.showsTurn) {
            // The question keeps one place as the book folds, so a number half typed stays as typed.
            if (!canvasOnScreen && !checkFirst) canvas()
            check()
            if (!canvasOnScreen && checkFirst) canvas()

            if (result != null) {
                val guessUnit = (content.content as? GuessRevealContent)?.value?.fields?.unit
                ActivityFeedback(frame.check, activityAnswer, result.isCorrect, places, guessUnit)
            }
        }
    }
}

@Composable
private fun ActivityCheckArea(
    check: ActivityCheck,
    answer: ActivityAnswer?,
    phase: ActivityPhase,
    locked: Boolean,
    onAnswerChange: (ActivityAnswer?) -> Unit,
    places: Int?,
    questionAlreadyShown: Boolean = false,
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
                label = check.value.question,
            )
        }
    } else if (check is NumericCheckValue) {
        NumericCheckField(check.value, answer, locked, onAnswerChange, places, showQuestion = !questionAlreadyShown)
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
    places: Int?,
    showQuestion: Boolean = true,
) {
    val locale = currentLocale()
    var typed by rememberSaveable { mutableStateOf<String?>(null) }
    val value = answer.numericValue
    val shown =
        typed?.takeIf { parseLocalizedNumber(it, locale) == value }
            ?: value?.let { formatNumber(it, locale, exactFractionDigitsFor(check.answer, check.allowed, it), grouping = false) }
            ?: typed.orEmpty()
    val unit = check.unit

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (showQuestion) CheckQuestion(check.question)
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
            label = stringResource(R.string.player_your_answer),
            visualTransformation =
                unit?.let {
                    com.zoonk.android.ui.components.NumberUnitTransformation(
                        it,
                        locale,
                        MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                    ?: androidx.compose.ui.text.input.VisualTransformation.None,
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            textStyle = MaterialTheme.typography.bodyLarge.withTabularFigures(),
        )
        places?.let { places ->
            Text(decimalEntryRule(places), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        }
    }
}

internal val NumericCheck.allowed: Double
    get() =
        when (tolerance.kind) {
            ActivityExpectedFormulaTolerance.Kind.ABSOLUTE -> tolerance.`value`
            ActivityExpectedFormulaTolerance.Kind.RELATIVE -> tolerance.`value` * abs(answer)
        }

internal fun NumericCheck.decimalPlaces(minTolerance: ActivityTolerance?): Int? {
    val expected = answer.toBigDecimal().stripTrailingZeros()
    val minimum =
        minTolerance?.let { tolerance ->
            if (tolerance.kind.value == "absolute") tolerance.`value` else tolerance.`value` * abs(answer)
        } ?: 0.0
    val acceptedDistance = maxOf(allowed, minimum)
    if (expected.scale() <= 0) return null
    return (0..expected.scale()).firstOrNull { places ->
        val scale = 10.0.pow(places)
        val rounded = floor(answer * scale + 0.5) / scale
        val distance = abs(rounded - answer)
        val slack = 1e-9 * maxOf(abs(answer), abs(rounded), acceptedDistance)
        distance <= maxOf(acceptedDistance + slack, 1e-9 * maxOf(1.0, abs(answer))) ||
            (rounded.toBigDecimal().stripTrailingZeros().precision() >= 2 && distance <= 0.5 / scale * (1 + 1e-9))
    }
}

internal fun NumericCheck.answerDigits(
    value: Double?,
    places: Int? = null,
): Int =
    maxOf(
        places ?: 0,
        exactFractionDigitsFor(answer, allowed, value ?: answer),
        value?.toBigDecimal()?.stripTrailingZeros()?.scale() ?: 0,
    )

@Composable
internal fun ExploredActivityCanvas(
    explore: ExploredActivity,
    cantListen: Boolean,
) {
    val renderer = activityRenderers[explore.frame.template] ?: return

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        ScreenCanvas {
            renderer.canvas(
                ActivityProps(
                    explore.content,
                    answer = null,
                    expected = explore.expected,
                    isCorrect = null,
                    phase = ActivityPhase.Explore,
                    isLocked = false,
                    onAnswerChange = {},
                    cantListen = cantListen,
                    baseMap = explore.baseMap,
                ),
            )
        }
        if (renderer.showsData(explore.content)) ActivityDataNote(explore.frame)
    }
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
    places: Int?,
    guessUnit: String?,
) {
    val reveal = LocalFeedbackReveal.current

    FeedbackPanel(label = stringResource(R.string.player_answer_feedback), modifier = Modifier.revealPart(reveal, RevealPart.Feedback)) {
        FeedbackVerdict(
            text = stringResource(if (isCorrect) R.string.player_verdict_correct else R.string.player_verdict_incorrect),
            tone = if (isCorrect) FeedbackTone.Right else FeedbackTone.Wrong,
            modifier = Modifier.revealPart(reveal, RevealPart.Verdict),
        )

        when (check) {
            is ChoiceCheckValue -> {
                val options = check.value.options
                val chosenId = answer.choiceId
                val chosen = options.firstOrNull { it.id == chosenId }
                val correct = options.firstOrNull { it.isCorrect }

                chosen?.let { FeedbackText(it.reason) }
                if (correct != null && chosen?.isCorrect != true) {
                    RightAnswerLine(correct.text)
                    FeedbackText(correct.reason)
                }
            }

            is NumericCheckValue -> {
                val numeric = check.value
                val locale = currentLocale()
                val value = answer.numericValue
                val unit = if (guessUnit == null) numeric.unit else currencyUnit(guessUnit)
                val digits = if (guessUnit == null) numeric.answerDigits(value, places) else null

                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), itemVerticalAlignment = Alignment.CenterVertically) {
                    value?.let {
                        LabeledLine(
                            stringResource(R.string.player_activity_your_answer),
                            formatAmount(it, locale, unit, maximumFractionDigits = digits),
                            tabular = true,
                        )
                    }
                    if (!isCorrect) {
                        if (value != null) Text("·", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        RightAnswerLine(formatAmount(numeric.answer, locale, unit, maximumFractionDigits = digits), tabular = true)
                    }
                }
                FeedbackText(numeric.explanation)
            }

            is InteractionCheckValue -> {
                FeedbackText(check.value.explanation)
            }
        }

        LocalResultNotes.current?.invoke()
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
) {
    val style = MaterialTheme.typography.bodyMedium
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = style)
        Text(
            answer,
            color = MaterialTheme.colorScheme.onSurface,
            style = (if (tabular) style.withTabularFigures() else style).copy(fontWeight = FontWeight.Medium),
        )
    }
}
