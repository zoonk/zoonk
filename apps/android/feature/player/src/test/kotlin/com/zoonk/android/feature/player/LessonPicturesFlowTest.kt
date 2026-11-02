package com.zoonk.android.feature.player

import android.content.Context
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import coil3.ImageLoader
import coil3.intercept.Interceptor
import coil3.request.ErrorResult
import coil3.request.ImageResult
import com.zoonk.android.data.PrivateImages
import com.zoonk.android.feature.player.model.StepImage
import com.zoonk.android.ui.components.PrivatePictures
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
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
}
