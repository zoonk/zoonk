package com.zoonk.android.feature.tutor

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.characters.BuddyKind
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.components.Belt
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Review screenshots of an empty conversation with a short and a tall buddy, written only on demand:
 * `./gradlew :feature:plan:testDebugUnitTest --tests '*TutorEmptyScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class TutorEmptyScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = PHONE)
    fun shortBuddy() = capture("tutor-empty-otto-baby-phone", BuddyLook(kind = BuddyKind.Otto, belt = Belt.White))

    @Test
    @Config(qualifiers = PHONE)
    fun tallBuddy() = capture("tutor-empty-zu-adult-phone", BuddyLook(kind = BuddyKind.Zu, belt = Belt.Black))

    @Test
    @Config(qualifiers = PHONE)
    fun noodleYoung() = capture("tutor-empty-noodle-young-phone", BuddyLook(kind = BuddyKind.Noodle, belt = Belt.Orange))

    private fun capture(
        name: String,
        look: BuddyLook,
    ) {
        compose.setContent {
            ZoonkTheme {
                Surface(Modifier.fillMaxSize()) {
                    EmptyThread(
                        TutorIdentity("Sam", look),
                        listOf(TutorSuggestion("Explain this more simply"), TutorSuggestion("Give me an example")),
                        canAsk = true,
                        onSelect = {},
                    )
                }
            }
        }
        compose.waitForIdle()
        val bitmap: Bitmap = compose.onRoot().captureRender().asAndroidBitmap()
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        println("Screenshot ${file.path}")
    }
}

private const val PHONE = "w411dp-h891dp-xxhdpi"
