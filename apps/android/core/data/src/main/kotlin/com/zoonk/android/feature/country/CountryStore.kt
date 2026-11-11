package com.zoonk.android.feature.country

import androidx.compose.runtime.Immutable
import androidx.core.os.LocaleListCompat
import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.Audience
import com.zoonk.android.data.KeyedResources
import com.zoonk.android.data.perform
import com.zoonk.android.data.shownLocale
import com.zoonk.api.apis.GoalsApi.LanguageListCountries
import com.zoonk.api.models.CountryCatalogCountriesInner
import com.zoonk.api.models.GoalContentCountryLessonVariety
import com.zoonk.api.models.LearningProfileSuggestedInner
import kotlin.time.Duration.Companion.days

/** A country a picker offers: [lessonVariety] is the language lessons would use for it, when core discloses one; [home] marks where the learner lives. */
@Immutable
data class CountryChoice(
    val code: String,
    val name: String,
    val lessonVariety: GoalContentCountryLessonVariety? = null,
    val home: Boolean = false,
)

fun LearningProfileSuggestedInner.choice() = CountryChoice(code, name, home = tag == LearningProfileSuggestedInner.Tag.HOME)

fun List<LearningProfileSuggestedInner>.choices() = map { it.choice() }

fun CountryCatalogCountriesInner.choice() = CountryChoice(code, name)

fun interface CountryApi {
    /** Every country, named and sorted in [language]. */
    suspend fun catalog(language: String): List<CountryChoice>
}

class LiveCountryApi(
    private val api: ApiClients,
) : CountryApi {
    override suspend fun catalog(language: String) =
        perform { api.clients(null).goals.listCountries(LanguageListCountries.entries.firstOrNull { it.value == language } ?: LanguageListCountries.EN) }
            .countries
            .map { it.choice() }
}

/** The pickers' full list, by language: the same for everyone, read when a picker opens and kept for a day, as the API caches it. */
class CountryStore(
    private val api: CountryApi,
    cache: AppCache,
) {
    val catalog: KeyedResources<String, List<CountryChoice>> =
        cache.keyed(Audience.Everyone, maxAge = 1.days) { _, language -> api.catalog(language) }
}

/** The language of the app's copy, which names countries in Settings and the Plan's picker. */
fun shownLanguage(): String {
    val locales = LocaleListCompat.getDefault()
    return shownLocale(List(locales.size()) { locales[it]!! }).language
}
