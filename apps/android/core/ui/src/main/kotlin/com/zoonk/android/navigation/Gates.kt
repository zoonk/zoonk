package com.zoonk.android.navigation

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRowScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.scaffold.BeforeFold
import com.zoonk.android.ui.scaffold.BottomBar

@Composable
fun SignInGate(
    ended: Boolean,
    navigator: AppNavigator,
    padding: PaddingValues,
) {
    GateMessage(
        icon = R.drawable.ic_lock,
        title = stringResource(if (ended) R.string.gate_session_ended_title else R.string.gate_sign_in_title),
        description = if (ended) stringResource(R.string.gate_session_ended_description) else null,
        padding = padding,
        // A learner who was logged out still has a plan; a second start would make a new one.
        inPage =
            if (ended) {
                null
            } else {
                { OutlinedButton(onClick = { navigator.open(AppRoute.StartGoal()) }) { Text(stringResource(R.string.gate_build_plan)) } }
            },
    ) { main ->
        Button(onClick = { navigator.open(AppRoute.Login) }, modifier = main) { Text(stringResource(R.string.gate_log_in)) }
    }
}

/**
 * A gate that is the page's whole content: its words centered, an optional [inPage] button under them,
 * and its main action ([action], given the `main` modifier of [TaskActions]) in the page's bottom bar.
 */
@Composable
fun GateMessage(
    @DrawableRes icon: Int,
    title: String,
    description: String?,
    padding: PaddingValues,
    inPage: (@Composable () -> Unit)? = null,
    action: @Composable FlowRowScope.(main: Modifier) -> Unit,
) {
    Column(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) {
        BeforeFold(Modifier.weight(1f)) { beforeFold ->
            Box(
                modifier =
                    beforeFold
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(24.dp),
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Icon(painterResource(icon), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        text = title,
                        style = MaterialTheme.typography.headlineSmall,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.semantics { heading() },
                    )
                    if (description != null) {
                        Text(
                            text = description,
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                        )
                    }
                    inPage?.invoke()
                }
            }
        }
        BottomBar { TaskActions(content = action) }
    }
}
