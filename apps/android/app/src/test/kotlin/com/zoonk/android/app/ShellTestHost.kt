package com.zoonk.android.app

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation3.runtime.NavEntry
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.RoutePlaceholder
import com.zoonk.android.navigation.rememberAppNavigator
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

@Composable
fun ShellTestHost() {
    val navigator = rememberAppNavigator()
    val app = remember { AppContainer() }
    val entries = remember(navigator) { testEntries(app, navigator) }

    ShellTest.navigator = navigator
    AppShell(navigator, entries)
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
