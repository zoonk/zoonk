package com.zoonk.android.feature.catalog

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.CountingApi
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.settle
import com.zoonk.android.data.waitFor
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LessonStartedReadsTest {
    @get:Rule
    val rule = createComposeRule()

    private val api = CountingApi(mapOf(PROGRESS to """{"started":false}"""))

    @After
    fun stop() = api.close()

    @Test
    fun aPageShownAgainReadsWhetherItsLessonWasStartedOnce() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val catalog =
            CatalogStore(LiveCatalogApi(api.clients), AppCache(FakeSession(AuthenticatedSession(ANA, "token-a", "local-a")), scope))
        val started = catalog.lessonStarted[LESSON]
        var shown by mutableStateOf(true)

        rule.setContent { ZoonkTheme { if (shown) catalog.isStarted(LESSON) } }
        rule.waitFor { started.state.value is LoadState.Loaded }
        rule.runOnIdle { shown = false }
        rule.runOnIdle { shown = true }
        rule.settle(started)

        assertEquals(1, api.requests(PROGRESS))
    }

    private companion object {
        const val LESSON = "c0ffee00-0000-4000-8000-0000000000aa"
        const val PROGRESS = "/library/lessons/$LESSON/progress"
    }
}
