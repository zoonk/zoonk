package com.zoonk.android.feature.conversation

import androidx.annotation.DrawableRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.intl.LocaleList
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.ui.components.MarkStatus
import com.zoonk.android.ui.components.StatusMark
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.android.ui.scaffold.TaskExitConfirmation
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.api.models.ExamSpeakingTask
import com.zoonk.api.models.LanguageConversation
import com.zoonk.api.models.LanguageConversationIntro
import com.zoonk.api.models.LanguageConversationIntroObjectivesInner
import com.zoonk.api.models.SpeakingMockExam

internal val CALL_COLUMN = 640.dp
private val AVATAR_MIN = 40.dp

/**
 * A call's task frame: its [content] in one column, and [aside] beside it, full height behind a
 * hairline, where there's room (main's task aside from `lg`); where there isn't, [content] is told
 * so and shows it inline. On wide windows the main action sits at its own width at the bar's end.
 */
@Composable
internal fun CallFrame(
    title: String,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
    listState: LazyListState = rememberLazyListState(),
    exitConfirmation: TaskExitConfirmation? = null,
    bottomBar: (@Composable () -> Unit)? = null,
    aside: (@Composable ColumnScope.() -> Unit)? = null,
    content: LazyListScope.(asideBeside: Boolean) -> Unit,
) {
    val wide = currentWindowAdaptiveInfoV2().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_MEDIUM_LOWER_BOUND)
    val frame: @Composable (Boolean) -> Unit = { beside ->
        TaskScaffold(
            onClose = onClose,
            modifier = modifier,
            title = { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
            exitConfirmation = exitConfirmation,
            bottomBar =
                bottomBar?.let { bar ->
                    {
                        CompositionLocalProvider(LocalWideBar provides wide) {
                            Box(
                                Modifier.fillMaxWidth(),
                                Alignment.Center,
                            ) { Box(Modifier.widthIn(max = CALL_COLUMN), Alignment.CenterEnd) { bar() } }
                        }
                    }
                },
        ) { padding ->
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize().padding(padding),
                horizontalAlignment = Alignment.CenterHorizontally,
                contentPadding = PaddingValues(top = 8.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) { content(beside) }
        }
    }
    if (aside == null) {
        frame(false)
        return
    }
    PageWithSupportingPane(
        supportingPane = {
            Row(Modifier.fillMaxSize()) {
                VerticalDivider()
                Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Vertical + WindowInsetsSides.End))
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp),
                    content = aside,
                )
            }
        },
    ) { beside -> frame(beside) }
}

/** Whether the bar is on a wide window, where its main action keeps its own width. */
internal val LocalWideBar = staticCompositionLocalOf { false }

/** A bar's main action: the bar's width on a phone, its own at the bar's end on wide windows. */
@Composable
internal fun Modifier.barAction(): Modifier = if (LocalWideBar.current) this else fillMaxWidth()

/** One item of a call's column, at its reading width. */
internal fun Modifier.callItem(): Modifier = widthIn(max = CALL_COLUMN).fillMaxWidth().padding(horizontal = 16.dp)

@Composable
internal fun conversationTitle(conversation: LanguageConversation): String =
    callTitle(conversation.exam, conversation.examTask, conversation.kind == LanguageConversation.Kind.CHECKPOINT)

@Composable
internal fun conversationTitle(intro: LanguageConversationIntro): String =
    callTitle(intro.exam, intro.examTask, intro.kind == LanguageConversationIntro.Kind.CHECKPOINT)

@Composable
private fun callTitle(
    exam: SpeakingMockExam?,
    examTask: ExamSpeakingTask?,
    checkpoint: Boolean,
): String =
    when {
        exam == SpeakingMockExam.IELTS -> stringResource(R.string.conversation_ielts_mock)
        exam == SpeakingMockExam.TOEFL -> stringResource(R.string.conversation_toefl_mock)
        examTask != null -> examTask.title
        checkpoint -> stringResource(R.string.conversation_unit_challenge)
        else -> stringResource(R.string.conversation_practice_call)
    }

/** Marks where a spoken line's words go in its sentence ("You: …"). */
internal const val MARK = "\u2063"

/** [template] read aloud with [text] in [language] where its [MARK] is, as TalkBack reads a line of the call. */
internal fun spokenAs(
    template: String,
    text: String,
    language: String,
) = buildAnnotatedString {
    append(template.substringBefore(MARK))
    append(inLanguage(text, language))
    append(template.substringAfter(MARK, ""))
}

/** Words in the language the learner studies, so TalkBack reads them in that language. */
internal fun inLanguage(
    text: String,
    language: String,
) = buildAnnotatedString { withStyle(SpanStyle(localeList = LocaleList(language))) { append(text) } }

@Composable
internal fun CharacterRow(
    name: String,
    detail: String,
    modifier: Modifier = Modifier,
    talking: Boolean = false,
) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Surface(
            shape = CircleShape,
            color = MaterialTheme.colorScheme.secondaryContainer,
            border = BorderStroke(2.dp, if (talking) MaterialTheme.colorScheme.outline else MaterialTheme.colorScheme.secondaryContainer),
            modifier = Modifier.clearAndSetSemantics {},
        ) {
            // A circle at any text size: the initial's line plus room around it, never under 40dp.
            val side =
                with(LocalDensity.current) {
                    maxOf(
                        AVATAR_MIN,
                        MaterialTheme.typography.titleSmall.lineHeight
                            .toDp() + 16.dp,
                    )
                }
            Box(Modifier.size(side), contentAlignment = Alignment.Center) {
                Text(name.trim().take(1).uppercase(), style = MaterialTheme.typography.titleSmall, textAlign = TextAlign.Center)
            }
        }
        Text(
            buildAnnotatedString {
                withStyle(SpanStyle(color = MaterialTheme.colorScheme.onSurface)) { append(name) }
                append(" · ")
                append(detail)
            },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

/** A call's goals, met or not, in the call's language; [describe] says how, on the intro. */
@Composable
internal fun Checklist(
    objectives: List<LanguageConversationIntroObjectivesInner>,
    language: String,
    met: (String) -> Boolean,
    modifier: Modifier = Modifier,
    describe: Boolean = false,
) {
    Column(modifier) {
        objectives.forEachIndexed { index, objective ->
            if (index > 0) HorizontalDivider()
            ChecklistRow(
                label = inLanguage(objective.label, language),
                done = met(objective.label),
                description = objective.description.takeIf { describe },
            )
        }
    }
}

@Composable
internal fun ChecklistRow(
    label: AnnotatedString,
    done: Boolean,
    modifier: Modifier = Modifier,
    description: String? = null,
) {
    val state = stringResource(if (done) R.string.conversation_goal_done else R.string.conversation_goal_not_yet)
    Row(
        modifier.fillMaxWidth().padding(vertical = 10.dp).semantics(mergeDescendants = true) { stateDescription = state },
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        StatusMark(if (done) MarkStatus.Done else MarkStatus.Todo)
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(label, style = MaterialTheme.typography.bodyLarge)
            description?.let {
                Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
internal fun SectionTitle(
    text: String,
    modifier: Modifier = Modifier,
    trailing: String? = null,
) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(text, Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.titleSmall)
        trailing?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium) }
    }
}

/** Main's `CallNote` and `MicNote`: a small line with its icon. */
@Composable
internal fun CallNote(
    text: String,
    @DrawableRes icon: Int,
    modifier: Modifier = Modifier,
    announce: Boolean = false,
) {
    Row(
        modifier.semantics(mergeDescendants = true) { if (announce) liveRegion = LiveRegionMode.Polite },
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(
            painterResource(icon),
            contentDescription = null,
            modifier = Modifier.size(18.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
    }
}

/** A call that can't go on: what happened, as a headline and a line. */
@Composable
internal fun CallOffMessage(
    title: String,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier.padding(vertical = 24.dp).semantics {
            liveRegion = LiveRegionMode.Polite
        },
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
        content()
    }
}
