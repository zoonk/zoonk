package com.zoonk.android.feature.activities.sorting

import androidx.annotation.DrawableRes
import com.zoonk.android.R
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf12FieldsStepsInner.Icon

/** The closest Material Symbol to each Lucide icon a process step can name (core's `processIconNames`), with Apple's SF Symbol beside it. */
@DrawableRes
internal fun processIcon(icon: Icon): Int =
    when (icon) {
        Icon.ACTIVITY -> R.drawable.ic_ecg

        // waveform.path.ecg
        Icon.APPLE -> R.drawable.ic_nutrition

        // carrot
        Icon.ARROW_RIGHT_LEFT -> R.drawable.ic_sync_alt

        // arrow.left.arrow.right
        Icon.ATOM -> R.drawable.ic_atr

        // atom
        Icon.BABY -> R.drawable.ic_child_care

        // figure.and.child.holdinghands
        Icon.BANKNOTE -> R.drawable.ic_payments

        // banknote
        Icon.BATTERY -> R.drawable.ic_battery_full

        // battery.100percent
        Icon.BATTERY_CHARGING -> R.drawable.ic_battery_charging_full

        // battery.100percent.bolt
        Icon.BEAKER -> R.drawable.ic_science

        // flask
        Icon.BIRD -> R.drawable.ic_raven

        // bird
        Icon.BONE -> R.drawable.ic_skeleton

        // figure.arms.open
        Icon.BOOK_OPEN -> R.drawable.ic_menu_book

        // book
        Icon.BRAIN -> R.drawable.ic_cognition

        // brain
        Icon.BUG -> R.drawable.ic_bug_report

        // ladybug
        Icon.CALCULATOR -> R.drawable.ic_calculate

        // plus.forwardslash.minus
        Icon.CHECK -> R.drawable.ic_check

        // checkmark
        Icon.CLOCK -> R.drawable.ic_schedule

        // clock
        Icon.CLOUD -> R.drawable.ic_cloud

        // cloud
        Icon.CLOUD_LIGHTNING -> R.drawable.ic_thunderstorm

        // cloud.bolt
        Icon.CLOUD_RAIN -> R.drawable.ic_rainy

        // cloud.rain
        Icon.CLOUD_SNOW -> R.drawable.ic_weather_snowy

        // cloud.snow
        Icon.CODE -> R.drawable.ic_code

        // chevron.left.forwardslash.chevron.right
        Icon.COINS -> R.drawable.ic_toll

        // dollarsign.circle
        Icon.CPU -> R.drawable.ic_memory

        // cpu
        Icon.DATABASE -> R.drawable.ic_database

        // cylinder.split.1x2
        Icon.DNA -> R.drawable.ic_genetics

        // allergens
        Icon.DROPLET -> R.drawable.ic_water_drop

        // drop
        Icon.DROPLETS -> R.drawable.ic_humidity_high

        // drop.fill
        Icon.EARTH -> R.drawable.ic_public

        // globe.americas
        Icon.EGG -> R.drawable.ic_egg

        // oval.portrait
        Icon.EYE -> R.drawable.ic_visibility

        // eye
        Icon.FACTORY -> R.drawable.ic_factory

        // building.2
        Icon.FEATHER -> R.drawable.ic_history_edu

        // leaf
        Icon.FILE_TEXT -> R.drawable.ic_description

        // doc.text
        Icon.FILTER -> R.drawable.ic_filter_alt

        // line.3.horizontal.decrease
        Icon.FISH -> R.drawable.ic_set_meal

        // fish
        Icon.FLAG -> R.drawable.ic_flag

        // flag
        Icon.FLAME -> R.drawable.ic_local_fire_department

        // flame
        Icon.FLASK_CONICAL -> R.drawable.ic_experiment

        // testtube.2
        Icon.FLOWER -> R.drawable.ic_spa

        // camera.macro
        Icon.FOOTPRINTS -> R.drawable.ic_footprint

        // shoeprints.fill
        Icon.GAUGE -> R.drawable.ic_speed

        // gauge.with.dots.needle.33percent
        Icon.GAVEL -> R.drawable.ic_gavel

        // hammer
        Icon.GEM -> R.drawable.ic_diamond

        // diamond
        Icon.GLOBE -> R.drawable.ic_language

        // globe
        Icon.HAMMER -> R.drawable.ic_hardware

        // hammer
        Icon.HAND -> R.drawable.ic_back_hand

        // hand.raised
        Icon.HANDSHAKE -> R.drawable.ic_handshake

        // person.2
        Icon.HEART -> R.drawable.ic_favorite

        // heart
        Icon.HEART_PULSE -> R.drawable.ic_cardiology

        // bolt.heart
        Icon.HOURGLASS -> R.drawable.ic_hourglass_empty

        // hourglass
        Icon.KEY -> R.drawable.ic_key

        // key
        Icon.LANDMARK -> R.drawable.ic_account_balance

        // building.columns
        Icon.LAYERS -> R.drawable.ic_layers

        // square.3.layers.3d
        Icon.LEAF -> R.drawable.ic_eco

        // leaf
        Icon.LIGHTBULB -> R.drawable.ic_lightbulb

        // lightbulb
        Icon.LOCK -> R.drawable.ic_lock

        // lock
        Icon.MAGNET -> R.drawable.ic_attach_file

        // paperclip
        Icon.MAIL -> R.drawable.ic_mail

        // envelope
        Icon.MEGAPHONE -> R.drawable.ic_campaign

        // megaphone
        Icon.MERGE -> R.drawable.ic_merge

        // arrow.triangle.merge
        Icon.MICROSCOPE -> R.drawable.ic_biotech

        // microbe.circle
        Icon.MOON -> R.drawable.ic_dark_mode

        // moon
        Icon.MOUNTAIN -> R.drawable.ic_landscape

        // mountain.2
        Icon.MOUNTAIN_SNOW -> R.drawable.ic_landscape_2

        // mountain.2.fill
        Icon.ORBIT -> R.drawable.ic_orbit

        // circle.dashed
        Icon.PACKAGE -> R.drawable.ic_package_2

        // shippingbox
        Icon.PENCIL -> R.drawable.ic_edit

        // pencil
        Icon.PERSON_STANDING -> R.drawable.ic_person

        // figure.stand
        Icon.PICKAXE -> R.drawable.ic_construction

        // hammer.fill
        Icon.PILL -> R.drawable.ic_pill

        // pills
        Icon.PLUG -> R.drawable.ic_power

        // powerplug
        Icon.RABBIT -> R.drawable.ic_cruelty_free

        // hare
        Icon.RADIATION -> R.drawable.ic_warning

        // exclamationmark.triangle
        Icon.RAINBOW -> R.drawable.ic_looks

        // rainbow
        Icon.RECYCLE -> R.drawable.ic_recycling

        // arrow.3.trianglepath
        Icon.REFRESH_CW -> R.drawable.ic_refresh

        // arrow.clockwise
        Icon.REPEAT -> R.drawable.ic_repeat

        // repeat
        Icon.ROCKET -> R.drawable.ic_rocket_launch

        // paperplane
        Icon.SATELLITE -> R.drawable.ic_satellite_alt

        // antenna.radiowaves.left.and.right
        Icon.SCALE -> R.drawable.ic_scale

        // scalemass
        Icon.SCROLL -> R.drawable.ic_receipt_long

        // scroll
        Icon.SEARCH -> R.drawable.ic_search

        // magnifyingglass
        Icon.SEND -> R.drawable.ic_send

        // paperplane
        Icon.SERVER -> R.drawable.ic_dns

        // server.rack
        Icon.SHELL -> R.drawable.ic_cyclone

        // fossil.shell
        Icon.SHIP -> R.drawable.ic_directions_boat

        // ferry
        Icon.SHOPPING_CART -> R.drawable.ic_shopping_cart

        // cart
        Icon.SNOWFLAKE -> R.drawable.ic_ac_unit

        // snowflake
        Icon.SPLIT -> R.drawable.ic_call_split

        // arrow.triangle.branch
        Icon.SPROUT -> R.drawable.ic_potted_plant

        // leaf.fill
        Icon.STETHOSCOPE -> R.drawable.ic_stethoscope

        // stethoscope
        Icon.STORE -> R.drawable.ic_storefront

        // storefront
        Icon.SUN -> R.drawable.ic_sunny

        // sun.max
        Icon.SUNRISE -> R.drawable.ic_wb_twilight

        // sunrise
        Icon.SUNSET -> R.drawable.ic_nights_stay

        // sunset
        Icon.SYRINGE -> R.drawable.ic_syringe

        // syringe
        Icon.TELESCOPE -> R.drawable.ic_planet

        // binoculars
        Icon.TEST_TUBE -> R.drawable.ic_labs

        // testtube.2
        Icon.THERMOMETER -> R.drawable.ic_thermostat

        // thermometer.medium
        Icon.TIMER -> R.drawable.ic_timer

        // timer
        Icon.TORNADO -> R.drawable.ic_tornado

        // tornado
        Icon.TRASH -> R.drawable.ic_delete

        // trash
        Icon.TREE_DECIDUOUS -> R.drawable.ic_park

        // tree
        Icon.TREE_PINE -> R.drawable.ic_forest

        // tree.fill
        Icon.TRUCK -> R.drawable.ic_local_shipping

        // truck.box
        Icon.USERS -> R.drawable.ic_group

        // person.2
        Icon.UTENSILS -> R.drawable.ic_restaurant

        // fork.knife
        Icon.VOTE -> R.drawable.ic_how_to_vote

        // checkmark.seal
        Icon.WAVES -> R.drawable.ic_waves

        // water.waves
        Icon.WHEAT -> R.drawable.ic_grass

        // laurel.leading
        Icon.WIND -> R.drawable.ic_air

        // wind
        Icon.WORKFLOW -> R.drawable.ic_flowchart

        // flowchart
        Icon.WORM -> R.drawable.ic_gesture

        // scribble
        Icon.WRENCH -> R.drawable.ic_build

        // wrench.and.screwdriver
        Icon.ZAP -> R.drawable.ic_bolt // bolt
    }
