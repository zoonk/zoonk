package com.zoonk.android.data

import android.graphics.Bitmap
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import coil3.Image
import coil3.memory.MemoryCache
import coil3.request.SuccessResult
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import mockwebserver3.Dispatcher
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import mockwebserver3.RecordedRequest
import okio.Buffer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.GraphicsMode
import java.io.ByteArrayOutputStream
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class PrivateImagesTest {
    private val api = MockWebServer()
    private val elsewhere = MockWebServer()
    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    private val ana = AuthenticatedSession(ANA, "token-a", "local-a")
    private val bia = AuthenticatedSession(BIA, "token-b", "local-b")
    private val anaResponds = CountDownLatch(1)
    private lateinit var images: PrivateImages

    @Before
    fun start() {
        api.dispatcher =
            object : Dispatcher() {
                override fun dispatch(request: RecordedRequest): MockResponse =
                    when {
                        request.url.encodedPath == "/v1/files/moved.png" -> {
                            redirect()
                        }

                        request.headers["Authorization"] == "Bearer token-a" -> {
                            png(
                                width = 1,
                            ).also { anaResponds.await(5, TimeUnit.SECONDS) }
                        }

                        request.headers["Authorization"] == "Bearer token-b" -> {
                            png(width = 2)
                        }

                        else -> {
                            png(width = 3)
                        }
                    }
            }
        elsewhere.dispatcher =
            object : Dispatcher() {
                override fun dispatch(request: RecordedRequest) = png(width = 4)
            }
        api.start()
        elsewhere.start()
        images = PrivateImages(api.url("/v1/"), imageLoader(context, apiHttpClient()))
    }

    @After
    fun stop() {
        api.close()
        elsewhere.close()
    }

    @Test
    fun anEarlierLearnersSlowPictureNeverReachesTheNextLearner() =
        runBlocking {
            val url = api.url("/v1/files/course/1/cover.png").toString()
            val forAna = async(kotlinx.coroutines.Dispatchers.IO) { images.loader.execute(images.request(context, url, ana)) }
            Thread.sleep(200)
            val forBia = images.loader.execute(images.request(context, url, bia)) as SuccessResult
            anaResponds.countDown()
            val lateForAna = forAna.await() as SuccessResult

            assertEquals(2, forBia.image.width)
            assertEquals(1, lateForAna.image.width)
            assertEquals(2, cached(forBia.memoryCacheKey)?.width)
            val tokens = api.takeRequests(2).map { it.headers["Authorization"] }.toSet()
            assertEquals(setOf("Bearer token-a", "Bearer token-b"), tokens)

            images.forget(ana)
            assertNull(cached(lateForAna.memoryCacheKey))
            assertEquals(2, cached(forBia.memoryCacheKey)?.width)
        }

    @Test
    fun aPublicPictureNeverCarriesTheBearer() =
        runBlocking {
            // Public pictures share Coil's process-wide disk cache, so a path another test may have loaded on a reused port would never reach the server.
            val public = elsewhere.url("/covers/${UUID.randomUUID()}.png").toString()
            images.loader.execute(images.request(context, public, ana))
            assertNull(elsewhere.arrived().headers["Authorization"])
        }

    @Test
    fun aRedirectToAnotherHostDropsTheBearer() =
        runBlocking {
            val result = images.loader.execute(images.request(context, api.url("/v1/files/moved.png").toString(), ana))
            assertEquals(4, (result as SuccessResult).image.width)
            assertNull(elsewhere.arrived().headers["Authorization"])
        }

    @Test
    fun aPrivatePictureLoadsNothingWhileSignedOut() =
        runBlocking {
            images.loader.execute(images.request(context, api.url("/v1/files/course/1/cover.png").toString(), null))
            assertEquals(0, api.requestCount)
        }

    private fun cached(key: MemoryCache.Key?): Image? =
        key?.let {
            images.loader.memoryCache
                ?.get(it)
                ?.image
        }

    private fun MockWebServer.arrived(): RecordedRequest =
        checkNotNull(takeRequest(5, TimeUnit.SECONDS)) { "No request arrived within 5 s" }

    private fun MockWebServer.takeRequests(count: Int) = List(count) { arrived() }

    private fun redirect() =
        MockResponse
            .Builder()
            .code(302)
            .addHeader("Location", elsewhere.url("/moved.png").toString())
            .build()

    private fun png(width: Int): MockResponse {
        val bitmap = Bitmap.createBitmap(width, 1, Bitmap.Config.ARGB_8888)
        val bytes = ByteArrayOutputStream().also { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray()
        return MockResponse
            .Builder()
            .addHeader("Content-Type", "image/png")
            .body(Buffer().write(bytes))
            .build()
    }
}
