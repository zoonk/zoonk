package com.zoonk.android.feature.buddy

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.tutor.TutorGreeting
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.characters.buddyName
import com.zoonk.android.ui.components.GoalBox
import com.zoonk.android.ui.components.rememberGoalExamples
import com.zoonk.android.ui.scaffold.BeforeFold
import com.zoonk.api.models.BuddyStatus

/**
 * Main's buddy without a goal to tutor: it offers to plan one. An example fills the box; only the
 * learner's own send starts it, and a goal from search ([ask]) waits there the same way.
 */
@Composable
internal fun BuddyGoalStart(
    status: BuddyStatus,
    ask: String?,
    navigator: AppNavigator,
) {
    val look = status.look()
    val name = buddyName(look.kind, status.buddy.name)
    val goal = androidx.compose.runtime.key(ask) { rememberTextFieldState(ask.orEmpty()) }
    val examples = rememberGoalExamples().take(EXAMPLES).map { it.label }

    BeforeFold { beforeFold ->
        Box(Modifier.fillMaxSize().then(beforeFold), contentAlignment = Alignment.TopCenter) {
            Column(
                Modifier.widthIn(max = BUDDY_COLUMN_WIDTH).fillMaxSize().padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                    BuddyHeader(look, face = null, name = name, status = status)
                    TutorGreeting(stringResource(R.string.buddy_page_goal_greeting, name))
                }
                val examplesLabel = stringResource(R.string.goal_box_examples)
                FlowRow(
                    Modifier.semantics { contentDescription = examplesLabel },
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    examples.forEach { example -> GoalChip(example) { goal.setTextAndPlaceCursorAtEnd(example) } }
                }
                GoalBox(
                    state = goal,
                    onSubmit = { navigator.open(AppRoute.StartGoal(goal = it)) },
                    placeholder = stringResource(R.string.buddy_page_goal_placeholder),
                    hiddenLabel = stringResource(R.string.buddy_page_goal_label),
                )
            }
        }
    }
}

private const val EXAMPLES = 3

/**
 * Main's buddy example: small and quiet, it fills the box. Each chip reserves its 48dp touch height in layout, so
 * chips that wrap onto two lines never share a touch area.
 */
@Composable
private fun GoalChip(
    text: String,
    onClick: () -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val shape = MaterialTheme.shapes.small

    Text(
        text,
        Modifier
            .minimumInteractiveComponentSize()
            .clip(shape)
            .background(colors.surface)
            .border(1.dp, colors.outline, shape)
            .clickable(role = Role.Button, onClick = onClick)
            .heightIn(min = 26.dp)
            .wrapContentHeight(Alignment.CenterVertically)
            .padding(horizontal = 10.dp),
        color = colors.onSurfaceVariant,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
    )
}
