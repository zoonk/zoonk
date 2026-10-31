package com.zoonk.android.ui.components

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.shell.GoalMark
import com.zoonk.android.feature.account.AccountAvatar
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LearnerSummaryGoal
import com.zoonk.api.models.MeUser
import org.junit.Assert.assertFalse
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.util.UUID

@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w411dp-h900dp-xxhdpi")
class LetterMarkTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val user: MeUser =
        ApiJson.decodeFromString(
            """{"analyticsDisabled":false,"createdAt":"2026-01-01T00:00:00Z","displayUsername":null,"email":"ana@zoonk.test",
                "emailVerified":true,"id":"00000000-0000-4000-8000-000000000001","image":null,"name":"Ana",
                "updatedAt":"2026-01-01T00:00:00Z","username":null}""",
        )

    @Test
    fun theAvatarsLetterKeepsToItsCircleAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        compose.setContent { ZoonkTheme { AccountAvatar(user, size = 32.dp) } }

        val layouts = mutableListOf<TextLayoutResult>()
        compose.onNodeWithText("A", useUnmergedTree = true).performSemanticsAction(SemanticsActions.GetTextLayoutResult) { it(layouts) }
        assertFalse(layouts.single().didOverflowHeight)
    }

    /** Review renders of the shell's bar at twice the font size, written only with `-Pzoonk.shots=<folder>`. No goldens. */
    @OptIn(ExperimentalMaterial3Api::class)
    @Test
    fun renders() {
        val folder = System.getProperty("zoonk.shots").orEmpty()
        assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())
        RuntimeEnvironment.setFontScale(2f)
        val goal =
            LearnerSummaryGoal(
                courseChapterId = null,
                courseId = null,
                courseLevel = null,
                dailyMinutes = 20,
                id = UUID.randomUUID(),
                isActive = true,
                isSettingUp = false,
                kind = LearnerSummaryGoal.Kind.EXAM,
                status = LearnerSummaryGoal.Status.ACTIVE,
                targetDate = null,
                targetLanguage = null,
                title = "ENEM",
            )
        compose.setContent {
            ZoonkTheme {
                TopAppBar(
                    title = {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            GoalMark(goal)
                            Text(goal.title)
                        }
                    },
                    actions = { IconButton(onClick = {}) { AccountAvatar(user, size = 32.dp) } },
                )
            }
        }
        val file = File(folder, "top-bar-font200.png")
        file.parentFile?.mkdirs()
        file.outputStream().use {
            compose
                .onRoot()
                .captureToImage()
                .asAndroidBitmap()
                .compress(Bitmap.CompressFormat.PNG, 100, it)
        }
    }
}
