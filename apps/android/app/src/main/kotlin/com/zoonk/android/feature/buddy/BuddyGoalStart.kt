package com.zoonk.android.feature.buddy

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.tutor.TutorAvatar
import com.zoonk.android.feature.tutor.TutorIdentity
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.characters.buddyName
import com.zoonk.android.ui.components.GoalBox
import com.zoonk.android.ui.components.rememberGoalExamples
import com.zoonk.api.models.BuddyStatus

/**
 * Main's buddy without a goal to tutor: it offers to plan one. An example fills the box; only the
 * learner's own send starts it, and a goal from search ([ask]) waits there the same way.
 */
@Composable
internal fun BuddyGoalStart(
    status: BuddyStatus,
    ask: String?,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val earlier by app.earlierQuestions.questions.collectShown()
    val look = status.look()
    val name = buddyName(look.kind, status.buddy.name)
    var goal by rememberSaveable(ask) { mutableStateOf(ask.orEmpty()) }
    val examples = rememberGoalExamples().take(EXAMPLES).map { it.label }

    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.widthIn(max = BUDDY_COLUMN_WIDTH).fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                BuddyHeader(look, face = null, name = name, status = status)
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    TutorAvatar(TutorIdentity(name, look), AVATAR_SIZE)
                    Text(
                        stringResource(R.string.buddy_page_goal_greeting, name),
                        Modifier.weight(1f).padding(top = 4.dp),
                        style = MaterialTheme.typography.bodyLarge,
                    )
                }
                if (earlier.value != null) {
                    TextButton(onClick = { navigator.open(AppRoute.EarlierQuestions) }) {
                        Icon(painterResource(R.drawable.ic_history), contentDescription = null, Modifier.size(ButtonDefaults.IconSize))
                        Text(stringResource(R.string.buddy_page_earlier_questions), Modifier.padding(start = ButtonDefaults.IconSpacing))
                    }
                }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                examples.forEach { example -> SuggestionChip(onClick = { goal = example }, label = { Text(example) }) }
            }
            GoalBox(value = goal, onValueChange = { goal = it }, onSubmit = { navigator.open(AppRoute.StartGoal(goal = it)) })
        }
    }
}

private const val EXAMPLES = 3
private val AVATAR_SIZE = 32.dp
