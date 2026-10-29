package com.zoonk.android.feature.account

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.feature.onboarding.GoalError
import com.zoonk.android.feature.onboarding.start.GoalErrorAlert
import com.zoonk.android.feature.onboarding.start.GoalSenderViewModel
import com.zoonk.android.feature.onboarding.start.appLanguage
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.GoalBox
import com.zoonk.android.ui.components.GoalExamples
import com.zoonk.android.ui.components.rememberGoalExamples

/**
 * What a visitor sees on Today (DECISIONS #5): main's landing reduced to its one job, starting a
 * goal, with Log in for learners who have an account. The rest of main's landing stays on the web.
 */
@Composable
fun VisitorWelcome(
    app: AppContainer,
    navigator: AppNavigator,
    contentPadding: PaddingValues,
    modifier: Modifier = Modifier,
) {
    val sender = viewModel { GoalSenderViewModel(app.onboarding) }
    val language = appLanguage()

    VisitorWelcome(
        navigator = navigator,
        contentPadding = contentPadding,
        isSending = sender.isSending,
        error = sender.error,
        onSend = { words -> sender.send(words, language) { draftId -> navigator.open(AppRoute.StartGoal(draftId = draftId)) } },
        modifier = modifier,
    )
}

/** Reading the words is the tap's own POST: the start screen only opens the draft it saved. */
@Composable
fun VisitorWelcome(
    navigator: AppNavigator,
    contentPadding: PaddingValues,
    isSending: Boolean,
    error: GoalError?,
    onSend: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var goal by rememberSaveable { mutableStateOf("") }

    Box(
        modifier =
            modifier
                .fillMaxSize()
                .padding(contentPadding)
                .consumeWindowInsets(contentPadding)
                .imePadding()
                .verticalScroll(rememberScrollState()),
        contentAlignment = Alignment.TopCenter,
    ) {
        Column(
            modifier =
                Modifier
                    .widthIn(max = 640.dp)
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 32.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = stringResource(R.string.account_welcome_title),
                    modifier = Modifier.semantics { heading() },
                    style = MaterialTheme.typography.headlineMedium,
                )
                Text(
                    text = stringResource(R.string.account_welcome_description),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyLarge,
                )
            }

            GoalBox(
                value = goal,
                onValueChange = { goal = it },
                onSubmit = onSend,
                note = stringResource(R.string.account_welcome_note),
                isSubmitting = isSending,
            )

            GoalErrorAlert(error, onCreateAccount = { navigator.open(AppRoute.Login) }, onOpenPlan = { navigator.open(AppRoute.Plan()) })

            GoalExamples(examples = rememberGoalExamples(), onPick = onSend)

            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = { navigator.open(AppRoute.Terms) }) { Text(stringResource(R.string.account_terms)) }
                TextButton(onClick = { navigator.open(AppRoute.Privacy) }) { Text(stringResource(R.string.account_privacy)) }
            }
        }
    }
}
