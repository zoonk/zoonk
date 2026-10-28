package com.zoonk.android.app

import android.app.Application
import android.content.ComponentCallbacks2
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader

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

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        if (level >= ComponentCallbacks2.TRIM_MEMORY_BACKGROUND) container.cache.releaseInactive()
    }
}
