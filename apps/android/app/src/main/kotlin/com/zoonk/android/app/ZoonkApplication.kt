package com.zoonk.android.app

import android.app.Application
import android.content.ComponentCallbacks2
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import kotlinx.coroutines.cancel

class ZoonkApplication :
    Application(),
    SingletonImageLoader.Factory {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }

    override fun newImageLoader(context: PlatformContext): ImageLoader = container.images.loader

    // Robolectric calls this at each test's teardown and devices never do, so a test JVM doesn't keep every test's container:
    // https://github.com/robolectric/robolectric/blob/robolectric-4.17/robolectric/src/main/java/org/robolectric/android/internal/AndroidTestEnvironment.java#L551
    override fun onTerminate() {
        container.scope.cancel()
        super.onTerminate()
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        if (level >= ComponentCallbacks2.TRIM_MEMORY_BACKGROUND) container.cache.releaseInactive()
    }
}
