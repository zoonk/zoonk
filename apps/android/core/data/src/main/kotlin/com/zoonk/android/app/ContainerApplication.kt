package com.zoonk.android.app

/** The application, which holds the app's one container for what Android creates on its own, such as services. */
interface ContainerApplication {
    val container: AppContainer
}
