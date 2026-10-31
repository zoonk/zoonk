package com.zoonk.android.feature.activities.sorting

import androidx.annotation.DrawableRes
import com.zoonk.android.R
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf12FieldsStepsInner.Icon

/**
 * The closest Material Symbol to each Lucide icon a process step can name (core's
 * `processIconNames`); Apple's `ProcessIcons.swift` maps the same names to SF Symbols.
 */
@DrawableRes
internal fun processIcon(icon: Icon): Int =
    when (icon) {
        Icon.ACTIVITY -> R.drawable.ic_ecg
        Icon.APPLE -> R.drawable.ic_nutrition
        Icon.ARROW_RIGHT_LEFT -> R.drawable.ic_sync_alt
        Icon.ATOM -> R.drawable.ic_atr
        Icon.BABY -> R.drawable.ic_child_care
        Icon.BANKNOTE -> R.drawable.ic_payments
        Icon.BATTERY -> R.drawable.ic_battery_full
        Icon.BATTERY_CHARGING -> R.drawable.ic_battery_charging_full
        Icon.BEAKER -> R.drawable.ic_science
        Icon.BIRD -> R.drawable.ic_raven
        Icon.BONE -> R.drawable.ic_skeleton
        Icon.BOOK_OPEN -> R.drawable.ic_menu_book
        Icon.BRAIN -> R.drawable.ic_cognition
        Icon.BUG -> R.drawable.ic_bug_report
        Icon.CALCULATOR -> R.drawable.ic_calculate
        Icon.CHECK -> R.drawable.ic_check
        Icon.CLOCK -> R.drawable.ic_schedule
        Icon.CLOUD -> R.drawable.ic_cloud
        Icon.CLOUD_LIGHTNING -> R.drawable.ic_thunderstorm
        Icon.CLOUD_RAIN -> R.drawable.ic_rainy
        Icon.CLOUD_SNOW -> R.drawable.ic_weather_snowy
        Icon.CODE -> R.drawable.ic_code
        Icon.COINS -> R.drawable.ic_toll
        Icon.CPU -> R.drawable.ic_memory
        Icon.DATABASE -> R.drawable.ic_database
        Icon.DNA -> R.drawable.ic_genetics
        Icon.DROPLET -> R.drawable.ic_water_drop
        Icon.DROPLETS -> R.drawable.ic_water_drop
        Icon.EARTH -> R.drawable.ic_public
        Icon.EGG -> R.drawable.ic_egg
        Icon.EYE -> R.drawable.ic_visibility
        Icon.FACTORY -> R.drawable.ic_factory
        Icon.FEATHER -> R.drawable.ic_history_edu
        Icon.FILE_TEXT -> R.drawable.ic_description
        Icon.FILTER -> R.drawable.ic_filter_alt
        Icon.FISH -> R.drawable.ic_set_meal
        Icon.FLAG -> R.drawable.ic_flag
        Icon.FLAME -> R.drawable.ic_local_fire_department
        Icon.FLASK_CONICAL -> R.drawable.ic_experiment
        Icon.FLOWER -> R.drawable.ic_spa
        Icon.FOOTPRINTS -> R.drawable.ic_footprint
        Icon.GAUGE -> R.drawable.ic_speed
        Icon.GAVEL -> R.drawable.ic_gavel
        Icon.GEM -> R.drawable.ic_diamond
        Icon.GLOBE -> R.drawable.ic_language
        Icon.HAMMER -> R.drawable.ic_hardware
        Icon.HAND -> R.drawable.ic_back_hand
        Icon.HANDSHAKE -> R.drawable.ic_handshake
        Icon.HEART -> R.drawable.ic_favorite
        Icon.HEART_PULSE -> R.drawable.ic_cardiology
        Icon.HOURGLASS -> R.drawable.ic_hourglass_empty
        Icon.KEY -> R.drawable.ic_key
        Icon.LANDMARK -> R.drawable.ic_account_balance
        Icon.LAYERS -> R.drawable.ic_layers
        Icon.LEAF -> R.drawable.ic_eco
        Icon.LIGHTBULB -> R.drawable.ic_lightbulb
        Icon.LOCK -> R.drawable.ic_lock
        Icon.MAGNET -> R.drawable.ic_attach_file
        Icon.MAIL -> R.drawable.ic_mail
        Icon.MEGAPHONE -> R.drawable.ic_campaign
        Icon.MERGE -> R.drawable.ic_merge
        Icon.MICROSCOPE -> R.drawable.ic_biotech
        Icon.MOON -> R.drawable.ic_dark_mode
        Icon.MOUNTAIN -> R.drawable.ic_landscape
        Icon.MOUNTAIN_SNOW -> R.drawable.ic_landscape_2
        Icon.ORBIT -> R.drawable.ic_orbit
        Icon.PACKAGE -> R.drawable.ic_package_2
        Icon.PENCIL -> R.drawable.ic_edit
        Icon.PERSON_STANDING -> R.drawable.ic_person
        Icon.PICKAXE -> R.drawable.ic_construction
        Icon.PILL -> R.drawable.ic_pill
        Icon.PLUG -> R.drawable.ic_power
        Icon.RABBIT -> R.drawable.ic_cruelty_free
        Icon.RADIATION -> R.drawable.ic_warning
        Icon.RAINBOW -> R.drawable.ic_looks
        Icon.RECYCLE -> R.drawable.ic_recycling
        Icon.REFRESH_CW -> R.drawable.ic_refresh
        Icon.REPEAT -> R.drawable.ic_repeat
        Icon.ROCKET -> R.drawable.ic_rocket_launch
        Icon.SATELLITE -> R.drawable.ic_satellite_alt
        Icon.SCALE -> R.drawable.ic_scale
        Icon.SCROLL -> R.drawable.ic_receipt_long
        Icon.SEARCH -> R.drawable.ic_search
        Icon.SEND -> R.drawable.ic_send
        Icon.SERVER -> R.drawable.ic_dns
        Icon.SHELL -> R.drawable.ic_cyclone
        Icon.SHIP -> R.drawable.ic_directions_boat
        Icon.SHOPPING_CART -> R.drawable.ic_shopping_cart
        Icon.SNOWFLAKE -> R.drawable.ic_ac_unit
        Icon.SPLIT -> R.drawable.ic_call_split
        Icon.SPROUT -> R.drawable.ic_potted_plant
        Icon.STETHOSCOPE -> R.drawable.ic_stethoscope
        Icon.STORE -> R.drawable.ic_storefront
        Icon.SUN -> R.drawable.ic_sunny
        Icon.SUNRISE -> R.drawable.ic_wb_twilight
        Icon.SUNSET -> R.drawable.ic_nights_stay
        Icon.SYRINGE -> R.drawable.ic_syringe
        Icon.TELESCOPE -> R.drawable.ic_planet
        Icon.TEST_TUBE -> R.drawable.ic_labs
        Icon.THERMOMETER -> R.drawable.ic_thermostat
        Icon.TIMER -> R.drawable.ic_timer
        Icon.TORNADO -> R.drawable.ic_tornado
        Icon.TRASH -> R.drawable.ic_delete
        Icon.TREE_DECIDUOUS -> R.drawable.ic_park
        Icon.TREE_PINE -> R.drawable.ic_forest
        Icon.TRUCK -> R.drawable.ic_local_shipping
        Icon.USERS -> R.drawable.ic_group
        Icon.UTENSILS -> R.drawable.ic_restaurant
        Icon.VOTE -> R.drawable.ic_how_to_vote
        Icon.WAVES -> R.drawable.ic_waves
        Icon.WHEAT -> R.drawable.ic_grass
        Icon.WIND -> R.drawable.ic_air
        Icon.WORKFLOW -> R.drawable.ic_flowchart
        Icon.WORM -> R.drawable.ic_gesture
        Icon.WRENCH -> R.drawable.ic_build
        Icon.ZAP -> R.drawable.ic_bolt
    }
