package com.zoonk.android.feature.player.steps

import android.content.res.Configuration
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isShiftPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.intl.LocaleList
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.audio.VoiceAnswerRecorder
import com.zoonk.android.feature.player.engine.LessonPhase
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.LessonScreen
import com.zoonk.android.feature.player.engine.isNumberAnswer
import com.zoonk.android.feature.player.model.CheckOption
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.SpokenAnswerStepContent
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepResult
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.ui.components.AnswerOption
import com.zoonk.android.ui.components.AnswerOptionGroup
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.components.PictureFrame
import com.zoonk.android.ui.components.PrivatePicture
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.richtext.MathText
import com.zoonk.android.ui.richtext.RichInlineText
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.withTabularFigures
import kotlinx.coroutines.delay
import kotlin.time.Duration.Companion.seconds

private const val MAX_TYPED_ANSWER_LENGTH = 1000

private val SLOW_CHECK = 15.seconds

/** A whole number in the learner's digits. */
@Composable
fun count(value: Int): String = formatNumber(value.toDouble(), currentLocale())

@Composable
private fun ReadScene(content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(20.dp), content = content)
}

@Composable
internal fun QuestionScene(content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(24.dp), content = content)
}

@Composable
private fun BodyText(text: String) {
    RichText(text = text, style = MaterialTheme.typography.bodyLarge)
}

@Composable
internal fun FactHookView(
    step: LessonStep,
    content: StepContent.Fact,
) {
    ReadScene {
        StepPicture(step, PictureFrame.Hero)
        BodyText(content.content.text)
        LessonStepVisual(content.content.visual)
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
) {
    val guess = content.content
    val selectedId = (answer as? LessonAnswer.Hook)?.optionId

    QuestionScene {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            LabelChip(stringResource(R.string.player_guess_first), icon = R.drawable.ic_auto_awesome)
            StepPicture(step, PictureFrame.Question)
            LessonStepVisual(guess.visual)
            QuestionText(guess.question, answered = result != null)
        }

        ChoiceOptions(
            options = guess.options.map { ChoiceOption(it.id, it.text, it.isCorrect) },
            selectedId = selectedId,
            isChecked = result != null,
            isGuess = true,
            locked = locked,
            onSelect = { id -> actions.select(id?.let(LessonAnswer::Hook)) },
        )

        if (result == null) {
            Text(
                text = stringResource(R.string.player_guess_hint),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
internal fun ExplanationView(
    step: LessonStep,
    content: StepContent.Explanation,
) {
    val explanation = content.content

    ReadScene {
        StepPicture(step, PictureFrame.Hero)
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            explanation.title?.let { title ->
                RichInlineText(
                    text = title,
                    modifier = Modifier.semantics { heading() },
                    style = MaterialTheme.typography.titleMedium,
                )
            }
            BodyText(explanation.text)
        }
        LessonStepVisual(explanation.visual)
    }
}

@Composable
internal fun WorkedExampleView(
    step: LessonStep,
    content: StepContent.WorkedExample,
    revealed: Int,
) {
    val worked = content.content
    val steps = worked.steps.take(revealed)

    ReadScene {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            LabelChip(stringResource(R.string.player_worked_example), icon = R.drawable.ic_format_list_numbered)
            worked.title?.let { QuestionText(it) }
        }
        BodyText(worked.problem)
        StepPicture(step, PictureFrame.Inline)
        LessonStepVisual(worked.visual)

        val stepsLabel = stringResource(R.string.player_worked_example_steps)
        Column(
            modifier = Modifier.semantics { contentDescription = stepsLabel }.semantics { liveRegion = LiveRegionMode.Polite },
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            steps.forEachIndexed { index, line ->
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = count(index + 1),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyLarge.withTabularFigures(),
                    )
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        RichText(text = line.text, style = MaterialTheme.typography.bodyLarge)
                        line.math?.let { MathText(it) }
                    }
                }
            }
        }

        if (revealed >= worked.steps.size) {
            Surface(color = MaterialTheme.colorScheme.surfaceContainerHigh, shape = MaterialTheme.shapes.medium) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = stringResource(R.string.player_worked_example_result),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelLarge,
                    )
                    BodyText(worked.result)
                }
            }
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
) {
    val check = content.content

    QuestionScene {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            screen.step?.let { StepPicture(it, PictureFrame.Question) }
            ContextText(check.context)
            LessonStepVisual(check.visual)
            QuestionText(check.question, answered = result != null)
        }

        val pictured = screen.step?.takeIf { check.options.any { it.picture != null } }
        ChoiceOptions(
            options = check.options.map { ChoiceOption(it.id, it.text, it.isCorrect) },
            selectedId = (answer as? LessonAnswer.Check)?.optionId,
            isChecked = result != null,
            isGuess = false,
            locked = locked,
            onSelect = { id -> actions.select(id?.let(LessonAnswer::Check)) },
            columns = if (pictured != null) 2 else 1,
            optionContent =
                if (pictured != null) {
                    { option -> PictureOption(pictured, check.options.first { it.id == option.id }, isChecked = result != null) }
                } else {
                    { RichInlineText(text = it.text, style = MaterialTheme.typography.bodyLarge) }
                },
        )

        ExplainFirstButton(screen, actions)
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
fun SummaryIdeas(ideas: List<String>) {
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
) {
    val typed = content.content
    val isNumber = isNumberAnswer(typed.acceptedAnswers)
    val inOwnWords = !isNumber && typed.acceptedAnswers.isNullOrEmpty()
    val locked = state.phase != LessonPhase.Playing
    val text = (answer as? LessonAnswer.Typed)?.text.orEmpty()

    QuestionScene {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (inOwnWords) LabelChip(stringResource(R.string.player_in_your_own_words), icon = R.drawable.ic_edit)
            ContextText(typed.context)
            LessonStepVisual(typed.visual)
            QuestionText(typed.question, answered = state.phase == LessonPhase.Feedback)
        }

        AnswerField(text, { actions.select(it?.let(LessonAnswer::Typed)) }, state, actions, isNumber)

        if (!locked) {
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
 * Main's spoken screen: said into L8's recorder, or typed when the learner can't talk today or the
 * microphone is blocked. Both are graded by the server.
 */
@Composable
internal fun SpokenAnswerView(
    step: LessonStep,
    content: StepContent.SpokenAnswer,
    answer: LessonAnswer?,
    state: LessonPlayerState,
    actions: StepActions,
    navigator: AppNavigator,
) {
    val spoken = content.content
    val locked = state.phase != LessonPhase.Playing
    var micBlocked by rememberSaveable(step.id) { mutableStateOf(false) }
    val types = actions.cantTalk || micBlocked

    QuestionScene {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            QuestionText(spoken.prompt, answered = state.phase == LessonPhase.Feedback)
            TargetText(spoken)
        }

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
            val switchTo = { cantTalk: Boolean ->
                actions.select(null)
                micBlocked = false
                actions.setCantTalk(cantTalk)
            }
            if (types) {
                GhostAction(
                    R.drawable.ic_mic,
                    stringResource(if (actions.cantTalk) R.string.player_can_talk_now else R.string.player_say_it_instead),
                ) { switchTo(false) }
            } else {
                GhostAction(R.drawable.ic_keyboard, stringResource(R.string.player_cant_talk_now)) { switchTo(true) }
            }
        }
    }
}

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

/** Enter checks a written answer; a number's field keeps Enter for the keyboard's own use. */
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
            placeholder = { Text(stringResource(if (isNumber) R.string.player_your_answer else R.string.player_write_your_answer)) },
            minLines = if (isNumber) 1 else 3,
            singleLine = isNumber,
            keyboardOptions = if (isNumber) KeyboardOptions(keyboardType = KeyboardType.Decimal) else KeyboardOptions.Default,
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
private fun GhostAction(
    icon: Int,
    label: String,
    onClick: () -> Unit,
) {
    val inset = ButtonDefaults.TextButtonWithIconContentPadding.calculateStartPadding(LocalLayoutDirection.current)

    TextButton(onClick = onClick, modifier = Modifier.offset(x = -inset)) {
        Icon(painterResource(icon), contentDescription = null, modifier = Modifier.padding(end = 8.dp))
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
 * right option and a wrong pick stay, marked (a guess keeps every option). [columns] lays them out
 * as a grid, as picture options are.
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
    optionContent: @Composable (ChoiceOption) -> Unit = { RichInlineText(text = it.text, style = MaterialTheme.typography.bodyLarge) },
) {
    val label = stringResource(R.string.player_answer_options)
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
            if (isChecked && result == null && !isGuess) null else ShownOption(index + 1, option, picked, result)
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
    isChecked: Boolean,
) {
    val image = step.optionPictures[option.id]
    val alt = option.picture?.alt ?: option.text

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        when {
            image != null -> {
                PrivatePicture(image.url, image.alt, image.width, image.height, PictureFrame.Question, Modifier.fillMaxWidth())
            }

            step.imagePending -> {
                PicturePending(PictureFrame.Question)
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
        if (isChecked) {
            Text(option.text, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center, style = MaterialTheme.typography.labelLarge)
        }
    }
}
