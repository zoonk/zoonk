import {
  COUNTRY_COOKIE,
  USAGE_DATA_CONSENT_COUNTRIES,
  USAGE_DATA_COOKIE,
} from "@zoonk/utils/usage-data";

/** `usage-notice:` styles show the notice while `<html>` has it. */
export const USAGE_NOTICE_ATTRIBUTE = "data-usage-notice";

/**
 * The time zones of the countries that ask first, so a visitor's very first page, before the
 * browser knows its country, already has the notice and nothing moves when it's confirmed.
 */
const CONSENT_TIME_ZONES = [
  "Africa/Ceuta",
  "America/Cayenne",
  "America/Guadeloupe",
  "America/Marigot",
  "America/Martinique",
  "Arctic/Longyearbyen",
  "Asia/Famagusta",
  "Asia/Istanbul",
  "Asia/Nicosia",
  "Atlantic/Azores",
  "Atlantic/Canary",
  "Atlantic/Madeira",
  "Atlantic/Reykjavik",
  "Europe/Amsterdam",
  "Europe/Athens",
  "Europe/Berlin",
  "Europe/Bratislava",
  "Europe/Brussels",
  "Europe/Bucharest",
  "Europe/Budapest",
  "Europe/Busingen",
  "Europe/Copenhagen",
  "Europe/Dublin",
  "Europe/Helsinki",
  "Europe/Istanbul",
  "Europe/Lisbon",
  "Europe/Ljubljana",
  "Europe/London",
  "Europe/Luxembourg",
  "Europe/Madrid",
  "Europe/Malta",
  "Europe/Mariehamn",
  "Europe/Nicosia",
  "Europe/Oslo",
  "Europe/Paris",
  "Europe/Prague",
  "Europe/Riga",
  "Europe/Rome",
  "Europe/Sofia",
  "Europe/Stockholm",
  "Europe/Tallinn",
  "Europe/Vaduz",
  "Europe/Vienna",
  "Europe/Vilnius",
  "Europe/Warsaw",
  "Europe/Zagreb",
  "Europe/Zurich",
  "Indian/Mayotte",
  "Indian/Reunion",
];

/** Marks `<html>` before the first paint: the browser's country once known, its time zone before. */
export const USAGE_NOTICE_SCRIPT = `(function(){var c=document.cookie.split("; ");function r(n){for(var i=0;i<c.length;i++){if(c[i].indexOf(n+"=")===0){return c[i].slice(n.length+1)}}return null}if(r(${JSON.stringify(USAGE_DATA_COOKIE)})){return}var k=r(${JSON.stringify(COUNTRY_COOKIE)});var z=Intl.DateTimeFormat().resolvedOptions().timeZone;var a=k?${JSON.stringify(USAGE_DATA_CONSENT_COUNTRIES)}.indexOf(k)>=0:${JSON.stringify(CONSENT_TIME_ZONES)}.indexOf(z)>=0;document.documentElement.toggleAttribute(${JSON.stringify(USAGE_NOTICE_ATTRIBUTE)},a)})()`;
