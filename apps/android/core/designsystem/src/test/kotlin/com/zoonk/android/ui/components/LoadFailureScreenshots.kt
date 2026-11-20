package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class LoadFailureScreenshots {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before fun onlyOnDemand() = assumeTrue(folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xhdpi")
    fun phone() = capture("phone")

    @Test
    @Config(qualifiers = "w1280dp-h900dp-mdpi")
    fun tablet() = capture("tablet")

    private fun capture(size: String) {
        var scenario by mutableStateOf("page")
        compose.setContent {
            ZoonkTheme {
                PageScaffold(
                    onBack = {},
                    title = { Text("Statistics") },
                    bottomBar =
                        if (scenario ==
                            "embedded"
                        ) {
                            ({ TaskActions { main -> Button(onClick = {}, modifier = main) { Text("Continue") } } })
                        } else {
                            null
                        },
                ) { padding ->
                    Column(Modifier.padding(padding).verticalScroll(rememberScrollState())) {
                        if (scenario == "tiles") {
                            StatTiles(
                                2,
                                listOf(
                                    { StatTile("Study time", "45 min", it, onClick = {}) },
                                    { StatTile("Questions", "12", it, detail = "Answered today") },
                                ),
                            )
                        } else {
                            LoadFailedMessage(onRetry = {})
                        }
                    }
                }
            }
        }
        listOf("page", "embedded", "tiles").forEach {
            scenario = it
            compose.waitForIdle()
            writeRender(File(folder, "$it-$size.png"), compose.onRoot().captureRender().asAndroidBitmap())
        }
    }
}
