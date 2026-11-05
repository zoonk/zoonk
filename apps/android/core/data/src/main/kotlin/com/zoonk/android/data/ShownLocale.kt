package com.zoonk.android.data

import android.content.res.Configuration
import com.zoonk.android.navigation.AppLink
import java.util.Locale

/**
 * The locale of the app's copy: the first of the device's locales in a language Zoonk has, else
 * English in the first one's region, as Apple's `Locale.current` reads Catalan in Spain ("en-ES").
 */
fun Configuration.shownLocale(): Locale = shownLocale(List(locales.size()) { locales[it] })

internal fun shownLocale(locales: List<Locale>): Locale =
    locales.firstOrNull { it.language in AppLink.languages || it.isBidiPseudolocale() }
        ?: Locale
            .Builder()
            .setLocale(locales.first())
            .setLanguage("en")
            .setScript("")
            .build()

/** Debug builds translate `ar-XB`, Android's right-to-left pseudolocale, for layout checks. */
private fun Locale.isBidiPseudolocale() = language == "ar" && country == "XB"
