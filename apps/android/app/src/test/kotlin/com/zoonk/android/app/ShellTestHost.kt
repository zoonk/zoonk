package com.zoonk.android.app

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation3.runtime.NavEntry
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import com.zoonk.android.data.summary
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.RoutePlaceholder
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.scaffold.DockedActionBar
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.LearnerSummaryPlaces
import kotlinx.coroutines.launch
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf

object ShellTest {
    lateinit var navigator: AppNavigator
    val viewModelsCreated = mutableMapOf<String, Int>()
    val viewModelsCleared = mutableListOf<String>()

    fun reset() {
        viewModelsCreated.clear()
        viewModelsCleared.clear()
    }

    /** Lets Robolectric start [ShellTestActivity], which only the tests declare. */
    fun registerActivity() {
        val application = RuntimeEnvironment.getApplication()
        val info =
            ActivityInfo().apply {
                name = ShellTestActivity::class.java.name
                packageName = application.packageName
            }
        shadowOf(application.packageManager).addOrUpdateActivity(info)
    }
}

/** A goal with every Study place. */
val everyPlace: LearnerSummary =
    summary(
        readAt = 0,
        nextChangeAt = 0,
    ).copy(places = LearnerSummaryPlaces(exam = true, mindMaps = true, readyMistakes = 0, speaking = true))

@Composable
fun ShellTestHost(summary: LearnerSummary = everyPlace) {
    val navigator = rememberAppNavigator()
    val context = LocalContext.current
    val app = remember { AppContainer.preview(context) }
    val entries = remember(navigator) { testEntries(app, navigator) }

    ShellTest.navigator = navigator
    AppShell(navigator, entries, summary = summary)
}

class ShellTestActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { ShellTestHost() }
    }
}

private fun testEntries(
    app: AppContainer,
    navigator: AppNavigator,
): (NavKey) -> NavEntry<NavKey> =
    entryProvider(fallback = { key -> NavEntry(key) { RoutePlaceholder(key as AppRoute, app, navigator) } }) {
        entry<AppRoute.Today> { CountedList("today") }
        entry<AppRoute.Plan> { CountedList("plan") }
        entry<AppRoute.Buddy> { CountedList("buddy") }
        entry<AppRoute.Memory> { DockedActionPage() }
        entry<AppRoute.Chapter> { route ->
            viewModel { CountingViewModel("chapter:${route.chapterId}") }
            RoutePlaceholder(route, app, navigator)
        }
    }

private class CountingViewModel(
    private val name: String,
) : ViewModel() {
    init {
        ShellTest.viewModelsCreated[name] = (ShellTest.viewModelsCreated[name] ?: 0) + 1
    }

    override fun onCleared() {
        ShellTest.viewModelsCleared += name
    }
}

@Composable
private fun CountedList(name: String) {
    viewModel { CountingViewModel(name) }

    LazyColumn(
        modifier =
            Modifier
                .fillMaxSize()
                .testTag("list:$name"),
    ) {
        items(100) { index -> Text("$name $index", Modifier.testTag("row:$name:$index").padding(16.dp)) }
    }
}

/** A page with a docked action, like Today's Start on a phone, and a way to show a snackbar. */
@Composable
private fun DockedActionPage() {
    val snackbars = LocalSnackbarHostState.current
    val scope = rememberCoroutineScope()

    Column(Modifier.fillMaxSize()) {
        Box(Modifier.weight(1f))
        DockedActionBar(Modifier.testTag("docked")) {
            Button(onClick = { scope.launch { snackbars.showSnackbar("Saved") } }) { Text("Show") }
        }
    }
}
