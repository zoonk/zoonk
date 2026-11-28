package com.zoonk.android.feature.player

import android.content.Context
import androidx.activity.ComponentActivity
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsNode
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.isSelectable
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.text.TextLayoutResult
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import coil3.ImageLoader
import coil3.intercept.Interceptor
import coil3.request.ErrorResult
import coil3.request.ImageResult
import com.zoonk.android.data.PrivateImages
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepImage
import com.zoonk.android.ui.components.PrivatePictures
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.util.concurrent.ConcurrentLinkedQueue

@RunWith(AndroidJUnit4::class)
class LessonPicturesFlowTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val harness = LessonPlayerHarness(rule) { folder.newFolder() }

    @Test
    fun theNextScreensOptionPicturesLoadAhead() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val requested = ConcurrentLinkedQueue<String>()
        val loader =
            ImageLoader
                .Builder(context)
                .components {
                    add(
                        object : Interceptor {
                            override suspend fun intercept(chain: Interceptor.Chain): ImageResult {
                                requested += chain.request.data.toString()
                                return ErrorResult(null, chain.request, IllegalStateException("No pictures in tests"))
                            }
                        },
                    )
                }.build()
        val drawn = StepImage("arch", "https://blob.zoonk.test/arch.png", "A doorway with a right arch", 1024, 1280)
        val pictures = PrivatePictures(PrivateImages("https://api.zoonk.test/v1/".toHttpUrl(), loader), null)

        harness.play(
            listOf(explanationStep("idea"), pictureCheckStep("quiz").copy(optionPictures = mapOf("right" to drawn))),
            pictures = pictures,
        )

        rule.waitUntil { drawn.url in requested }
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi-qwerty")
    @GraphicsMode(GraphicsMode.Mode.NATIVE)
    fun anOptionsDescriptionKeepsClearOfItsKeyAndMark() {
        val step = pictureCheckStep("quiz")

        harness.play(listOf(step, summaryStep("end")))
        rule.waitForIdle()

        val options = rule.onAllNodes(isSelectable(), useUnmergedTree = true).fetchSemanticsNodes()
        assertEquals((step.content as StepContent.Check).content.options.size, options.size)
        options.forEach { option ->
            // The option's key and its mark are the only parts that clear their own semantics.
            val corners = option.children.filter { it.config.isClearingSemantics }.map { it.boundsInRoot }
            val lines = option.textLinesInRoot()
            assertEquals(2, corners.size)
            assertTrue(lines.isNotEmpty())
            lines.forEach { line ->
                corners.forEach { corner -> assertFalse("$line runs under $corner", line.overlaps(corner)) }
            }
        }
    }
}

private fun SemanticsNode.textLinesInRoot(): List<Rect> {
    val layouts = mutableListOf<TextLayoutResult>()
    config.getOrNull(SemanticsActions.GetTextLayoutResult)?.action?.invoke(layouts)
    val own =
        layouts.flatMap { layout ->
            (0 until layout.lineCount).filter { layout.getLineTop(it) < layout.size.height }.map {
                Rect(
                    layout.getLineLeft(it),
                    layout.getLineTop(it),
                    layout.getLineRight(it),
                    layout.getLineBottom(it),
                ).translate(positionInRoot)
            }
        }
    return own + children.flatMap { it.textLinesInRoot() }
}
