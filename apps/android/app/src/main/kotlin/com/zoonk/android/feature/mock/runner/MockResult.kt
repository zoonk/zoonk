package com.zoonk.android.feature.mock.runner

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.api.models.MockResult
import kotlin.math.floor

/** A finished mock: how it went in the exam's terms. */
@Composable
internal fun MockFinished(
    run: MockRun,
    navigator: AppNavigator,
) {
    TaskScaffold(
        onClose = { navigator.closeTask() },
        bottomBar = {
            Button(
                onClick = { navigator.closeTask() },
                modifier = Modifier.fillMaxWidth(),
            ) { Text(stringResource(R.string.mock_continue_section)) }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(STEP_PADDING), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            MockEyebrow(run.view)
            run.view.result?.let { StepTitle(resultLine(it)) }
        }
    }
}

@Composable
private fun resultLine(result: MockResult): String {
    val locale = currentLocale()
    val net = result.net
    return if (net != null) {
        stringResource(R.string.mock_net_score, formatNumber(net.net, locale), net.max.toInt())
    } else {
        pluralStringResource(
            R.plurals.mock_right_answers,
            floor(result.correct).toInt(),
            formatNumber(result.correct, locale),
            result.total.toInt(),
        )
    }
}
