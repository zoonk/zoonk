package com.zoonk.android.navigation

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.ZoonkApp
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/** Routes whose screens are drawn: their features' own tests open them. */
private val drawn = setOf(AppRoute.Lesson::class, AppRoute.Explain::class, AppRoute.PlacementMock::class)

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class RoutePlaceholderTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun everyRouteOpens() {
        lateinit var navigator: AppNavigator
        rule.setContent {
            navigator = rememberAppNavigator()
            ZoonkApp(app = AppContainer.preview(rule.activity), navigator = navigator)
        }

        routeSamples.filter { it.presentation != Presentation.Web && it::class !in drawn }.forEach { route ->
            rule.runOnIdle { navigator.open(route) }
            rule.runOnIdle { assertEquals(route, navigator.currentRoute) }
        }
    }
}
