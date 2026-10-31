package com.zoonk.android.feature.buddy

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.feature.tutor.AnswerText
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.api.models.EarlierQuestion
import kotlinx.coroutines.launch

/**
 * Main's earlier questions: kept so a course rewrite never reads as the learner's history deleted.
 * The lessons they were about are gone, so nothing here links to them.
 */
@Composable
fun EarlierQuestionsScreen(
    app: AppContainer,
    navigator: AppNavigator,
    store: EarlierQuestionsStore = app.earlierQuestions,
) {
    val state by store.questions.collectShown()
    val scope = rememberCoroutineScope()
    var isLoadingOlder by remember { mutableStateOf(false) }
    var olderFailed by rememberSaveable { mutableStateOf(false) }
    val column = Modifier.widthIn(max = COLUMN_WIDTH).fillMaxWidth()

    val loadOlder = {
        if (!isLoadingOlder) {
            isLoadingOlder = true
            olderFailed = false
            scope.launch {
                olderFailed = !store.loadOlder()
                isLoadingOlder = false
            }
        }
    }

    PageScaffold(onBack = { navigator.back() }, title = { Text(stringResource(R.string.earlier_questions_title)) }) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            item(key = "intro", contentType = "intro") {
                Text(
                    text = stringResource(R.string.earlier_questions_description),
                    modifier = column.padding(bottom = 24.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }

            when (val shown = state) {
                is LoadState.Loaded -> {
                    itemsIndexed(shown.value.questions, key = {
                        _,
                        question,
                        ->
                        question.id.toString()
                    }, contentType = { _, _ -> "question" }) {
                        index,
                        question,
                        ->
                        Column(column) {
                            if (index > 0) HorizontalDivider()
                            EarlierQuestionEntry(question, onOpenRoute = navigator::open)
                        }
                    }

                    if (shown.value.nextCursor != null) {
                        item(key = "older", contentType = "older") { OlderQuestions(isLoadingOlder, olderFailed, loadOlder, column) }
                    }
                }

                LoadState.Empty -> {
                    item(key = "empty", contentType = "empty") {
                        Text(
                            text = stringResource(R.string.earlier_questions_empty),
                            modifier = column,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }

                is LoadState.Failed -> {
                    item(key = "failed", contentType = "failed") {
                        LoadFailedMessage(onRetry = { scope.launch { store.questions.refresh() } }, modifier = column)
                    }
                }

                LoadState.Idle, LoadState.Loading -> {
                    item(key = "loading", contentType = "loading") {
                        Box(column.padding(48.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                    }
                }
            }
        }
    }
}

@Composable
private fun EarlierQuestionEntry(
    question: EarlierQuestion,
    onOpenRoute: (AppRoute) -> Unit,
) {
    Column(Modifier.padding(vertical = 20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = questionSource(question),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
        )
        Text(question.question, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium)

        val answer = question.answer
        if (answer != null) {
            AnswerText(answer, linksChecked = true, onOpenRoute = onOpenRoute)
        } else {
            Text(
                text = stringResource(R.string.earlier_questions_no_answer),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

/** Main leaves out a title the saved course didn't have, empty ones too. */
@Composable
private fun questionSource(question: EarlierQuestion): String {
    val course = question.courseTitle?.ifEmpty { null }
    val lesson = question.lessonTitle?.ifEmpty { null }

    return when {
        course != null && lesson != null -> stringResource(R.string.earlier_questions_from_course_lesson, course, lesson)
        course != null -> stringResource(R.string.earlier_questions_from_course, course)
        lesson != null -> stringResource(R.string.earlier_questions_from_lesson, lesson)
        else -> stringResource(R.string.earlier_questions_from)
    }
}

@Composable
private fun OlderQuestions(
    isLoading: Boolean,
    failed: Boolean,
    onLoad: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (failed) {
            Text(
                text = stringResource(R.string.earlier_questions_older_failed),
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        TextButton(onClick = onLoad, enabled = !isLoading, contentPadding = ButtonDefaults.TextButtonWithIconContentPadding) {
            if (isLoading) {
                CircularProgressIndicator(Modifier.size(ButtonDefaults.IconSize), color = LocalContentColor.current, strokeWidth = 2.dp)
                Spacer(Modifier.size(ButtonDefaults.IconSpacing))
            }
            Text(stringResource(R.string.earlier_questions_older))
        }
    }
}

private val COLUMN_WIDTH = 640.dp
