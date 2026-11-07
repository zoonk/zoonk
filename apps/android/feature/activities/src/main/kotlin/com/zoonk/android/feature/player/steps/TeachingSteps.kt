package com.zoonk.android.feature.player.steps

import android.content.res.Configuration
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isShiftPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.layoutId
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.intl.LocaleList
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.Resource
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.activities.ActivityAnnouncement
import com.zoonk.android.feature.audio.VoiceAnswerRecorder
import com.zoonk.android.feature.player.engine.LessonPhase
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.LessonScreen
import com.zoonk.android.feature.player.engine.isExploredPictureLost
import com.zoonk.android.feature.player.engine.isNumberAnswer
import com.zoonk.android.feature.player.language.LanguageStepView
import com.zoonk.android.feature.player.language.LessonLanguage
import com.zoonk.android.feature.player.model.CheckOption
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.SpokenAnswerStepContent
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepKind
import com.zoonk.android.feature.player.model.StepResult
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.ui.characters.Buddy
import com.zoonk.android.ui.characters.BuddyCrop
import com.zoonk.android.ui.components.AnswerOption
import com.zoonk.android.ui.components.AnswerOptionGroup
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.components.OutlinedTextField
import com.zoonk.android.ui.components.PendingPicture
import com.zoonk.android.ui.components.PictureFrame
import com.zoonk.android.ui.components.PictureShape
import com.zoonk.android.ui.components.PrivatePicture
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.isWideLayout
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.richtext.MathText
import com.zoonk.android.ui.richtext.RichInlineText
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.richtext.plainText
import com.zoonk.android.ui.richtext.rememberMathWords
import com.zoonk.android.ui.richtext.typesetMath
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonkType
import kotlinx.coroutines.delay
import kotlin.time.Duration.Companion.seconds

private const val MAX_TYPED_ANSWER_LENGTH = 1000

private val SLOW_CHECK = 15.seconds

/** A whole number in the learner's digits. */
@Composable
fun count(value: Int): String = formatNumber(value.toDouble(), currentLocale())

@Composable
internal fun ReadScene(content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(20.dp), content = content)
}

@Composable
internal fun QuestionScene(content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(QUESTION_SPACING), content = content)
}

private val QUESTION_SPACING = 24.dp
private val BUDDY_FACE = 24.dp
private val QUESTION_PART_SPACING = 12.dp
private val MIN_YIELDED_PICTURE = 140.dp

/** The layout id of the screen part that takes the height the lesson screen's other parts leave in view. */
object FillsView

/**
 * A word bank's screen. In one narrow column the bank sits at the bottom of the view, just above the
 * actions, so it stays under the learner's thumb while the answer grows; once the screen outgrows the
 * view, the bank follows its content. A wide layout ([isWideLayout]) keeps it under the answer.
 */
@Composable
internal fun WordBankScene(
    question: @Composable ColumnScope.() -> Unit,
    bank: @Composable () -> Unit,
) {
    Column(
        Modifier.fillMaxWidth().then(if (isWideLayout()) Modifier else Modifier.layoutId(FillsView)),
        verticalArrangement = Arrangement.SpaceBetween,
    ) {
        QuestionScene(question)
        Box(Modifier.padding(top = QUESTION_SPACING)) { bank() }
    }
}

@Composable
private fun BodyText(text: String) {
    RichText(text = text, style = MaterialTheme.zoonkType.lessonText)
}

/** The opening scene. Once a knowledge lesson's map is tagged, its opening map follows the scene's words. */
@Composable
internal fun FactHookView(
    step: LessonStep,
    content: StepContent.Fact,
    part: StepPart,
    marking: LessonMarking?,
) {
    val map = marking?.map?.takeIf { part.showsScreen && it.opensLesson }

    ReadScene {
        if (part.showsTurn) StepPicture(step, PictureFrame.Hero)
        if (part.showsScreen) BodyText(content.content.text)
        if (part.showsTurn) LessonStepVisual(content.content.visual)
        if (map != null) OpeningMap(map)
    }
}

@Composable
internal fun GuessHookView(
    step: LessonStep,
    content: StepContent.Guess,
    answer: LessonAnswer?,
    result: StepResult?,
    locked: Boolean,
    actions: StepActions,
    part: StepPart,
    marking: LessonMarking?,
) {
    val guess = content.content

    HookScene(
        // Only a drawn picture gives up height: the placeholder and a picture's description need theirs.
        viewHeight = LocalStepViewHeight.current.takeIf { step.image != null },
        chip = {
            if (part.showsScreen) {
                Column(verticalArrangement = Arrangement.spacedBy(QUESTION_SPACING)) {
                    if (marking != null) IdeaStrip(marking.map, step.marks)
                    LabelChip(stringResource(R.string.player_guess_chip), icon = R.drawable.ic_auto_awesome)
                }
            }
        },
        picture = { if (part.showsScreen) StepPicture(step, PictureFrame.Question) },
        question = {
            if (part.showsScreen) {
                Column(verticalArrangement = Arrangement.spacedBy(QUESTION_PART_SPACING)) {
                    LessonStepVisual(guess.visual)
                    QuestionText(guess.question)
                }
            }
        },
        options = {
            if (part.showsTurn) {
                ChoiceOptions(
                    options = guess.options.map { ChoiceOption(it.id, it.text, it.isCorrect) },
                    selectedId = (answer as? LessonAnswer.Hook)?.optionId,
                    isChecked = result != null,
                    isGuess = true,
                    locked = locked,
                    onSelect = { id -> actions.select(id?.let(LessonAnswer::Hook)) },
                )
            }
        },
    )
}

/**
 * The hook's picture comes first. In one column of [viewHeight] it gives the question and its options
 * the height they need, down to [MIN_YIELDED_PICTURE]; when even that doesn't leave them room, the
 * column scrolls.
 */
@Composable
private fun HookScene(
    viewHeight: Dp?,
    chip: @Composable () -> Unit,
    picture: @Composable () -> Unit,
    question: @Composable () -> Unit,
    options: @Composable () -> Unit,
) {
    Layout(listOf(chip, picture, question, options), Modifier.fillMaxWidth()) { slots, constraints ->
        val loose = constraints.copy(minWidth = 0, minHeight = 0)
        val partGap = QUESTION_PART_SPACING.roundToPx()
        val sceneGap = QUESTION_SPACING.roundToPx()
        val (chips, pictures, questions, optionList) = slots
        val (chipParts, questionParts, optionParts) = listOf(chips, questions, optionList).map { part -> part.map { it.measure(loose) } }
        val others =
            chipParts.sumOf { it.height } + questionParts.sumOf { it.height } + optionParts.sumOf { it.height } + partGap * 2 + sceneGap
        val pictureRoom = viewHeight?.let { (it.roundToPx() - others).coerceAtLeast(MIN_YIELDED_PICTURE.roundToPx()) }
        val pictureParts = pictures.map { it.measure(if (pictureRoom == null) loose else loose.copy(maxHeight = pictureRoom)) }
        val rows =
            listOf(chipParts to partGap, pictureParts to partGap, questionParts to sceneGap, optionParts to 0)
                .filter { (parts, _) -> parts.any { it.height > 0 } }
        val height = rows.sumOf { (parts, _) -> parts.sumOf { it.height } } + rows.dropLast(1).sumOf { (_, gap) -> gap }

        layout(constraints.maxWidth, height) {
            var y = 0
            rows.forEach { (parts, gap) ->
                parts.forEach { part ->
                    part.placeRelative(0, y)
                    y += part.height
                }
                y += gap
            }
        }
    }
}

@Composable
internal fun ExplanationView(
    step: LessonStep,
    content: StepContent.Explanation,
    actions: StepActions,
    part: StepPart,
    marking: LessonMarking?,
) {
    val explanation = content.content

    ReadScene {
        if (part.showsScreen && marking != null) IdeaStrip(marking.map, step.marks)
        if (part.showsTurn) StepPicture(step, PictureFrame.Hero)
        if (part.showsScreen) {
            TeachingText(
                explanation.title,
                explanation.text,
                step.marks.takeIf { marking != null },
                marksTerms =
                    marking != null,
            )
        }
        if (part.showsTurn) {
            LessonStepVisual(explanation.visual)
            content.explore?.takeUnless { step.isExploredPictureLost }?.let { ExploredActivityCanvas(it, actions.cantListen) }
        }
        if (part.showsScreen && explanation.exampleLineSlot != null) actions.exampleLine(step.id)?.let { ExampleLine(it) }
        if (part.showsScreen && marking != null) DidntGetItButton()
    }
}

@Composable
private fun DidntGetItButton() {
    val simpler = LocalAskSimpler.current ?: return
    GhostAction(
        label = stringResource(R.string.player_didnt_get_it),
        onClick = simpler.ask,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        leading = simpler.look?.let { look -> { Buddy(look, Modifier.size(BUDDY_FACE), crop = BuddyCrop.Face) } },
    )
}

/** Main's `ExampleLine`: the explanation's idea in the learner's own life, once it's written; nothing when none fits. */
@Composable
private fun ExampleLine(line: Resource<String>) {
    val state by line.collectShown()
    val text = state.value ?: return
    val style = MaterialTheme.typography.bodyLarge

    Row(
        Modifier.height(IntrinsicSize.Min).semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        VerticalDivider(Modifier.fillMaxHeight().padding(end = 4.dp), thickness = 2.dp)
        Icon(
            painter = painterResource(R.drawable.ic_person),
            contentDescription = stringResource(R.string.player_your_example),
            modifier = Modifier.size(with(LocalDensity.current) { style.lineHeight.toDp() }),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        RichInlineText(text = text, modifier = Modifier.weight(1f), style = style)
    }
}

@Composable
internal fun WorkedExampleView(
    step: LessonStep,
    content: StepContent.WorkedExample,
    revealed: Int,
    part: StepPart,
    marking: LessonMarking?,
) {
    val worked = content.content
    val marksTerms = marking != null
    val steps = worked.steps.take(revealed)
    val isDone = revealed >= worked.steps.size
    val newest = remember { BringIntoViewRequester() }
    var shown by rememberSaveable(step.id) { mutableIntStateOf(revealed) }

    LaunchedEffect(revealed) {
        if (revealed > shown) newest.bringIntoView()
        shown = revealed
    }

    // On a spread, the problem with its picture or chart is the screen, and its steps unfold on the learner's page,
    // above the button that shows the next one.
    ReadScene {
        if (part.showsScreen) {
            if (marking != null) IdeaStrip(marking.map, step.marks)
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                LabelChip(stringResource(R.string.player_worked_example), icon = R.drawable.ic_format_list_numbered)
                worked.title?.let { QuestionText(it) }
            }
            TeachingText(title = null, text = worked.problem, marks = step.marks.takeIf { marking != null }, marksTerms = marksTerms)
            StepPicture(step, PictureFrame.Inline)
            LessonStepVisual(worked.visual)
        }
        if (part.showsTurn) {
            val stepsLabel = stringResource(R.string.player_worked_example_steps)
            val words = rememberMathWords()
            val arrived = steps.lastOrNull()?.takeIf { revealed > 1 }
            Box {
                // Main's polite list reads out each line as it's revealed; a live region on the list would reread every line.
                ActivityAnnouncement(
                    arrived
                        ?.let { line -> listOfNotNull(plainText(line.text), line.math?.let { typesetMath(it, words).spoken }) }
                        .orEmpty()
                        .joinToString(" "),
                )
                Column(
                    modifier = Modifier.semantics { contentDescription = stepsLabel },
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    steps.forEachIndexed { index, line ->
                        Row(
                            Modifier.then(if (index == steps.lastIndex && !isDone) Modifier.bringIntoViewRequester(newest) else Modifier),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Text(
                                text = count(index + 1),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodyLarge.withTabularFigures(),
                            )
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                RichText(text = line.text, style = MaterialTheme.typography.bodyLarge, marksTerms = marksTerms)
                                line.math?.let { MathText(it) }
                            }
                        }
                    }
                }
            }

            if (isDone) {
                Surface(
                    modifier = Modifier.bringIntoViewRequester(newest),
                    color = MaterialTheme.colorScheme.surfaceContainerHigh,
                    shape = MaterialTheme.shapes.medium,
                ) {
                    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            text = stringResource(R.string.player_worked_example_result),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.labelLarge,
                        )
                        RichText(text = worked.result, style = MaterialTheme.typography.bodyLarge, marksTerms = marksTerms)
                    }
                }
            }
            if (marking != null) DidntGetItButton()
        }
    }
}

@Composable
internal fun CheckView(
    content: StepContent.Check,
    answer: LessonAnswer?,
    result: StepResult?,
    locked: Boolean,
    screen: LessonScreen,
    actions: StepActions,
    part: StepPart,
    marking: LessonMarking?,
) {
    val check = content.content

    QuestionScene {
        if (part.showsScreen && marking != null) screen.step?.let { IdeaStrip(marking.map, it.marks) }
        if (part.showsScreen) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                screen.step?.let { StepPicture(it, PictureFrame.Question) }
                ContextText(check.context)
                LessonStepVisual(check.visual)
                QuestionText(check.question)
            }
        }

        if (part.showsTurn) {
            val pictured = screen.step?.takeIf { check.options.any { it.picture != null } }
            val optionCaption: (@Composable (ChoiceOption) -> Unit)? =
                if (pictured != null && result != null) {
                    {
                        Text(
                            it.text,
                            modifier = Modifier.fillMaxWidth(),
                            textAlign = TextAlign.Center,
                            style = MaterialTheme.typography.labelLarge,
                        )
                    }
                } else {
                    null
                }
            var crowded by remember(pictured?.id) { mutableStateOf(false) }
            ChoiceOptions(
                options = check.options.map { ChoiceOption(it.id, it.text, it.isCorrect) },
                selectedId = (answer as? LessonAnswer.Check)?.optionId,
                isChecked = result != null,
                isGuess = false,
                locked = locked,
                onSelect = { id -> actions.select(id?.let(LessonAnswer::Check)) },
                columns = if (pictured != null && !crowded) 2 else 1,
                keysAtTop = pictured != null,
                optionReadingContent = optionCaption,
                onReadingOverflow = { crowded = true },
                optionContent =
                    if (pictured != null) {
                        { option ->
                            PictureOption(
                                pictured,
                                check.options.first { it.id == option.id },
                                caption = { optionCaption?.invoke(option) },
                            ) { crowded = true }
                        }
                    } else {
                        { RichInlineText(text = it.text) }
                    },
            )

            ExplainFirstButton(screen, actions)
        }
    }
}

@Composable
internal fun SummaryView(content: StepContent.Summary) {
    val ideas = content.content.ideas

    ReadScene {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = stringResource(R.string.player_summary),
                modifier = Modifier.semantics { heading() },
                style = MaterialTheme.typography.headlineSmall,
            )
            Text(
                text = pluralStringResource(R.plurals.player_summary_ideas, ideas.size, count(ideas.size)),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyLarge,
            )
        }
        SummaryIdeas(ideas.map { it.text })
    }
}

@Composable
private fun SummaryIdeas(ideas: List<String>) {
    Column {
        ideas.forEachIndexed { index, idea ->
            if (index > 0) HorizontalDivider()
            Row(Modifier.padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = count(index + 1),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyLarge.withTabularFigures(),
                )
                RichInlineText(text = idea, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
            }
        }
    }
}

@Composable
internal fun TypedAnswerView(
    step: LessonStep,
    content: StepContent.TypedAnswer,
    answer: LessonAnswer?,
    state: LessonPlayerState,
    screen: LessonScreen,
    actions: StepActions,
    part: StepPart,
    marking: LessonMarking?,
) {
    val typed = content.content
    val isNumber = isNumberAnswer(typed.acceptedAnswers)
    val inOwnWords = !isNumber && typed.acceptedAnswers.isNullOrEmpty()
    val locked = state.phase != LessonPhase.Playing
    val text = (answer as? LessonAnswer.Typed)?.text.orEmpty()

    QuestionScene {
        if (part.showsScreen && marking != null) IdeaStrip(marking.map, step.marks)
        if (part.showsScreen) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (inOwnWords) LabelChip(stringResource(R.string.player_in_your_own_words), icon = R.drawable.ic_edit)
                ContextText(typed.context)
                LessonStepVisual(typed.visual)
                QuestionText(typed.question)
            }
        }

        if (part.showsTurn) AnswerField(text, { actions.select(it?.let(LessonAnswer::Typed)) }, state, actions, isNumber)

        if (part.showsTurn && !locked) {
            Column {
                ExplainFirstButton(screen, actions)
                if (!isNumber) {
                    if (!screen.canExplainFirst) {
                        GhostAction(R.drawable.ic_help, stringResource(R.string.player_dont_know_yet)) { actions.dontKnow(step.id) }
                    }
                    GhostAction(R.drawable.ic_edit_off, stringResource(R.string.player_cant_write_now), actions::skipWriting)
                }
            }
        }
    }
}

/**
 * Main's spoken screen: said into L8's recorder; when the learner can't talk today, built from the
 * heard sentence if the step has its listening exercise, else typed, as when the microphone is
 * blocked. All are graded by the server.
 */
@Composable
internal fun SpokenAnswerView(
    step: LessonStep,
    content: StepContent.SpokenAnswer,
    answer: LessonAnswer?,
    state: LessonPlayerState,
    actions: StepActions,
    navigator: AppNavigator,
    language: LessonLanguage,
    part: StepPart,
) {
    val spoken = content.content
    val locked = state.phase != LessonPhase.Playing
    var micBlocked by rememberSaveable(step.id) { mutableStateOf(false) }
    val types = actions.cantTalk || micBlocked
    val switchTo = { cantTalk: Boolean ->
        actions.select(null)
        micBlocked = false
        actions.setCantTalk(cantTalk)
    }
    val listening = content.listeningInstead(actions.cantTalk)

    if (listening != null) {
        LanguageStepView(listening, answer, state.results[step.id], locked, language, actions, part)
        if (part.showsTurn && !locked) GhostAction(R.drawable.ic_mic, stringResource(R.string.player_can_talk_now)) { switchTo(false) }
        return
    }

    QuestionScene {
        if (part.showsScreen) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                QuestionText(spoken.prompt)
                TargetText(spoken)
            }
        }

        if (part.showsTurn) {
            when {
                types -> {
                    if (micBlocked && !locked) {
                        Text(
                            stringResource(R.string.player_microphone_blocked),
                            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                    AnswerField(
                        (answer as? LessonAnswer.Spoken)?.text.orEmpty(),
                        { actions.select(it?.let(LessonAnswer::Spoken)) },
                        state,
                        actions,
                    )
                }

                !locked -> {
                    VoiceAnswerRecorder(
                        grade = { recording -> actions.gradeSpoken(step.id, recording) },
                        onGraded = {},
                        navigator = navigator,
                        key = "spoken:${step.id}",
                        onBlocked = { micBlocked = true },
                    )
                }
            }

            if (!locked) {
                if (types) {
                    GhostAction(
                        R.drawable.ic_mic,
                        stringResource(if (actions.cantTalk) R.string.player_can_talk_now else R.string.player_say_it_instead),
                    ) { switchTo(false) }
                } else {
                    val icon = if (content.listening != null) R.drawable.ic_headphones else R.drawable.ic_keyboard
                    GhostAction(icon, stringResource(R.string.player_cant_talk_now)) { switchTo(true) }
                }
            }
        }
    }
}

internal fun StepContent.SpokenAnswer.listeningInstead(cantTalk: Boolean): StepContent.Language? =
    listening?.takeIf { cantTalk }?.let { StepContent.Language(StepKind.Listening, it, wordHints = null) }

@Composable
private fun TargetText(spoken: SpokenAnswerStepContent) {
    val translation = spoken.translation?.takeIf { it.isNotBlank() && it.trim() != spoken.targetText.trim() }

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            text = spoken.targetText,
            style = MaterialTheme.typography.headlineSmall.copy(localeList = LocaleList(spoken.language)),
        )
        listOfNotNull(spoken.romanization, translation).forEach {
            Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

/**
 * A number's single line already turns Enter into Done, so only a written answer catches Enter
 * itself. Compose closes the keyboard once the field turns read-only for the check.
 */
@Composable
private fun AnswerField(
    text: String,
    onChange: (String?) -> Unit,
    state: LessonPlayerState,
    actions: StepActions,
    isNumber: Boolean = false,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = text,
            onValueChange = { value -> onChange(value.take(MAX_TYPED_ANSWER_LENGTH).takeIf { it.isNotEmpty() }) },
            modifier =
                (if (isNumber) Modifier.widthIn(min = 192.dp) else Modifier.fillMaxWidth())
                    .onPreviewKeyEvent { event ->
                        val submits = event.key == Key.Enter && !event.isShiftPressed && !isNumber
                        if (submits && event.type == KeyEventType.KeyDown) actions.runPrimary()
                        submits
                    },
            readOnly = state.phase != LessonPhase.Playing,
            label = stringResource(R.string.player_your_answer),
            placeholder = { if (!isNumber) Text(stringResource(R.string.player_write_your_answer)) },
            minLines = if (isNumber) 1 else 3,
            singleLine = isNumber,
            keyboardOptions =
                KeyboardOptions(
                    keyboardType = if (isNumber) KeyboardType.Decimal else KeyboardType.Unspecified,
                    imeAction = ImeAction.Done,
                ),
            keyboardActions =
                KeyboardActions(onDone = {
                    actions.runPrimary()
                    defaultKeyboardAction(ImeAction.Done)
                }),
            textStyle = MaterialTheme.typography.bodyLarge.let { if (isNumber) it.withTabularFigures() else it },
        )
        AnswerHint(state, isNumber)
    }
}

@Composable
private fun AnswerHint(
    state: LessonPlayerState,
    isNumber: Boolean,
) {
    var slow by remember { mutableStateOf(false) }
    val checking = state.phase == LessonPhase.Checking
    val hasKeyboard = LocalConfiguration.current.keyboard != Configuration.KEYBOARD_NOKEYS

    LaunchedEffect(checking) {
        slow = false
        if (checking) {
            delay(SLOW_CHECK)
            slow = true
        }
    }

    val (text, isError) =
        when {
            state.checkFailed -> stringResource(R.string.player_check_failed) to true
            checking && slow -> stringResource(R.string.player_still_checking) to false
            !isNumber && state.phase == LessonPhase.Playing && hasKeyboard -> stringResource(R.string.player_enter_hint) to false
            else -> return
        }

    Text(
        text = text,
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = if (isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodySmall,
    )
}

@Composable
internal fun ExplainFirstButton(
    screen: LessonScreen,
    actions: StepActions,
) {
    if (screen.canExplainFirst) {
        GhostAction(R.drawable.ic_menu_book, stringResource(R.string.player_explain_first), actions::explainFirst)
    }
}

/** Main's ghost actions line their icon up with the column's text. */
@Composable
internal fun GhostAction(
    icon: Int,
    label: String,
    onClick: () -> Unit,
) {
    GhostAction(label, onClick) { Icon(painterResource(icon), contentDescription = null) }
}

@Composable
internal fun GhostAction(
    label: String,
    onClick: () -> Unit,
    color: Color = Color.Unspecified,
    leading: (@Composable () -> Unit)?,
) {
    val inset = ButtonDefaults.TextButtonWithIconContentPadding.calculateStartPadding(LocalLayoutDirection.current)

    TextButton(
        onClick = onClick,
        modifier = Modifier.offset(x = -inset),
        colors = ButtonDefaults.textButtonColors(contentColor = color),
    ) {
        leading?.let { Box(Modifier.padding(end = 8.dp)) { it() } }
        Text(label)
    }
}

data class ChoiceOption(
    val id: String,
    val text: String,
    val isCorrect: Boolean,
)

/**
 * Options picked by a tap or a number key; tapping a pick again clears it. Once checked, only the
 * right option and a wrong pick stay, marked, unless [keepsEveryOption] (a guess keeps every option
 * too). [columns] lays them out as a grid, as picture options are; [keysAtTop] keeps each number at
 * the top beside a picture, which has no line of words to sit on.
 */
@Composable
fun ChoiceOptions(
    options: List<ChoiceOption>,
    selectedId: String?,
    isChecked: Boolean,
    isGuess: Boolean,
    locked: Boolean,
    onSelect: (String?) -> Unit,
    columns: Int = 1,
    keysAtTop: Boolean = false,
    keepsEveryOption: Boolean = false,
    label: String = stringResource(R.string.player_answer_options),
    optionReadingContent: (@Composable (ChoiceOption) -> Unit)? = null,
    onReadingOverflow: (() -> Unit)? = null,
    optionContent: @Composable (ChoiceOption) -> Unit = { RichInlineText(text = it.text) },
) {
    val shown =
        options.mapIndexedNotNull { index, option ->
            val picked = selectedId == option.id
            val result =
                when {
                    !isChecked -> null
                    option.isCorrect -> AnswerResult.Right
                    !picked -> null
                    isGuess -> AnswerResult.Guess
                    else -> AnswerResult.Wrong
                }
            if (isChecked && result == null && !isGuess && !keepsEveryOption) null else ShownOption(index + 1, option, picked, result)
        }

    AnswerOptionGroup(Modifier.semantics { contentDescription = label }) {
        shown.chunked(columns).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { item ->
                    AnswerOption(
                        marker = item.marker,
                        picked = item.picked,
                        result = item.result,
                        modifier = Modifier.weight(1f),
                        enabled = !locked && !isChecked,
                        keyAtTop = keysAtTop,
                        guessed = isGuess,
                        readingContent = optionReadingContent?.let { reading -> { reading(item.option) } },
                        onReadingOverflow = onReadingOverflow,
                        onClick = { onSelect(if (item.picked) null else item.option.id) },
                    ) { optionContent(item.option) }
                }
                repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

private data class ShownOption(
    val marker: Int,
    val option: ChoiceOption,
    val picked: Boolean,
    val result: AnswerResult?,
)

/** Main's `PictureOptionContent`: the option's picture, drawn or still drawing, and its name only once checked. */
@Composable
private fun PictureOption(
    step: LessonStep,
    option: CheckOption,
    caption: @Composable () -> Unit,
    onDescriptionOverflow: () -> Unit,
) {
    val image = step.optionPictures[option.id]
    val alt = option.picture?.alt ?: option.text

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        when {
            image != null -> {
                PrivatePicture(
                    image.url,
                    image.alt,
                    image.width,
                    image.height,
                    PictureFrame.Question,
                    Modifier.fillMaxWidth(),
                    PictureShape.Square,
                )
            }

            step.imagePending -> {
                PendingPicture(PictureFrame.Question, Modifier.fillMaxWidth(), PictureShape.Square) {
                    Icon(
                        painterResource(R.drawable.ic_image),
                        contentDescription = stringResource(R.string.player_drawing_picture),
                        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        alt,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodySmall,
                        textAlign = TextAlign.Center,
                        onTextLayout = { if (it.hasVisualOverflow) onDescriptionOverflow() },
                    )
                }
            }

            else -> {
                Surface(color = MaterialTheme.colorScheme.surfaceContainerHigh, shape = MaterialTheme.shapes.medium) {
                    Text(
                        alt,
                        modifier = Modifier.padding(12.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }
        caption()
    }
}
