package com.zoonk.android.navigation

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
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
import com.zoonk.android.ui.scaffold.BeforeFold

@Composable
fun SignInGate(
    ended: Boolean,
    navigator: AppNavigator,
    padding: PaddingValues,
) {
    GateMessage(
        icon = R.drawable.ic_lock,
        title = stringResource(if (ended) R.string.gate_session_ended_title else R.string.gate_sign_in_title),
        description =
            stringResource(if (ended) R.string.gate_session_ended_description else R.string.gate_sign_in_description),
        padding = padding,
    ) {
        Button(onClick = { navigator.open(AppRoute.Login) }) { Text(stringResource(R.string.gate_log_in)) }
        OutlinedButton(onClick = { navigator.open(AppRoute.StartGoal()) }) {
            Text(stringResource(if (ended) R.string.gate_start_something_new else R.string.gate_start_free))
        }
    }
}

@Composable
fun GateMessage(
    @DrawableRes icon: Int,
    title: String,
    description: String,
    padding: PaddingValues,
    actions: @Composable () -> Unit,
) {
    BeforeFold { beforeFold ->
        Box(
            modifier =
                beforeFold
                    .fillMaxSize()
                    .padding(padding)
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
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    actions()
                }
            }
        }
    }
}
