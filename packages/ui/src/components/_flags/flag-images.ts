// oxlint-disable-next-line typescript/triple-slash-reference -- apps and packages compile @zoonk/ui from source, so the SVG module type has to travel with the file that imports the flags.
/// <reference path="./flag-icons.d.ts" />
import { type LanguageFlagCode } from "@zoonk/utils/language-flags";
import afFlag from "flag-icons/flags/4x3/af.svg";
import alFlag from "flag-icons/flags/4x3/al.svg";
import amFlag from "flag-icons/flags/4x3/am.svg";
import arabFlag from "flag-icons/flags/4x3/arab.svg";
import azFlag from "flag-icons/flags/4x3/az.svg";
import baFlag from "flag-icons/flags/4x3/ba.svg";
import bdFlag from "flag-icons/flags/4x3/bd.svg";
import bgFlag from "flag-icons/flags/4x3/bg.svg";
import brFlag from "flag-icons/flags/4x3/br.svg";
import byFlag from "flag-icons/flags/4x3/by.svg";
import cnFlag from "flag-icons/flags/4x3/cn.svg";
import czFlag from "flag-icons/flags/4x3/cz.svg";
import deFlag from "flag-icons/flags/4x3/de.svg";
import dkFlag from "flag-icons/flags/4x3/dk.svg";
import eeFlag from "flag-icons/flags/4x3/ee.svg";
import esCtFlag from "flag-icons/flags/4x3/es-ct.svg";
import esGaFlag from "flag-icons/flags/4x3/es-ga.svg";
import esPvFlag from "flag-icons/flags/4x3/es-pv.svg";
import esFlag from "flag-icons/flags/4x3/es.svg";
import etFlag from "flag-icons/flags/4x3/et.svg";
import fiFlag from "flag-icons/flags/4x3/fi.svg";
import frFlag from "flag-icons/flags/4x3/fr.svg";
import gbWlsFlag from "flag-icons/flags/4x3/gb-wls.svg";
import geFlag from "flag-icons/flags/4x3/ge.svg";
import grFlag from "flag-icons/flags/4x3/gr.svg";
import hrFlag from "flag-icons/flags/4x3/hr.svg";
import huFlag from "flag-icons/flags/4x3/hu.svg";
import idFlag from "flag-icons/flags/4x3/id.svg";
import ieFlag from "flag-icons/flags/4x3/ie.svg";
import ilFlag from "flag-icons/flags/4x3/il.svg";
import inFlag from "flag-icons/flags/4x3/in.svg";
import irFlag from "flag-icons/flags/4x3/ir.svg";
import isFlag from "flag-icons/flags/4x3/is.svg";
import itFlag from "flag-icons/flags/4x3/it.svg";
import jpFlag from "flag-icons/flags/4x3/jp.svg";
import khFlag from "flag-icons/flags/4x3/kh.svg";
import krFlag from "flag-icons/flags/4x3/kr.svg";
import kzFlag from "flag-icons/flags/4x3/kz.svg";
import laFlag from "flag-icons/flags/4x3/la.svg";
import lkFlag from "flag-icons/flags/4x3/lk.svg";
import ltFlag from "flag-icons/flags/4x3/lt.svg";
import lvFlag from "flag-icons/flags/4x3/lv.svg";
import mgFlag from "flag-icons/flags/4x3/mg.svg";
import mkFlag from "flag-icons/flags/4x3/mk.svg";
import mmFlag from "flag-icons/flags/4x3/mm.svg";
import mnFlag from "flag-icons/flags/4x3/mn.svg";
import myFlag from "flag-icons/flags/4x3/my.svg";
import nlFlag from "flag-icons/flags/4x3/nl.svg";
import noFlag from "flag-icons/flags/4x3/no.svg";
import npFlag from "flag-icons/flags/4x3/np.svg";
import nzFlag from "flag-icons/flags/4x3/nz.svg";
import phFlag from "flag-icons/flags/4x3/ph.svg";
import pkFlag from "flag-icons/flags/4x3/pk.svg";
import plFlag from "flag-icons/flags/4x3/pl.svg";
import roFlag from "flag-icons/flags/4x3/ro.svg";
import rsFlag from "flag-icons/flags/4x3/rs.svg";
import ruFlag from "flag-icons/flags/4x3/ru.svg";
import seFlag from "flag-icons/flags/4x3/se.svg";
import siFlag from "flag-icons/flags/4x3/si.svg";
import skFlag from "flag-icons/flags/4x3/sk.svg";
import thFlag from "flag-icons/flags/4x3/th.svg";
import trFlag from "flag-icons/flags/4x3/tr.svg";
import tzFlag from "flag-icons/flags/4x3/tz.svg";
import uaFlag from "flag-icons/flags/4x3/ua.svg";
import usFlag from "flag-icons/flags/4x3/us.svg";
import uzFlag from "flag-icons/flags/4x3/uz.svg";
import vnFlag from "flag-icons/flags/4x3/vn.svg";
import zaFlag from "flag-icons/flags/4x3/za.svg";

/** A static SVG import: its URL (Turbopack) or image data with the URL in `src` (webpack). */
type FlagImage = string | { height: number; src: string; width: number };

/**
 * Every flag a language course can show, as static files the host's bundler serves (flag-icons,
 * MIT). The record must list every `LanguageFlagCode`, so a new language can't lose its flag.
 */
export const FLAG_IMAGES: Record<LanguageFlagCode, FlagImage> = {
  af: afFlag,
  al: alFlag,
  am: amFlag,
  arab: arabFlag,
  az: azFlag,
  ba: baFlag,
  bd: bdFlag,
  bg: bgFlag,
  br: brFlag,
  by: byFlag,
  cn: cnFlag,
  cz: czFlag,
  de: deFlag,
  dk: dkFlag,
  ee: eeFlag,
  es: esFlag,
  "es-ct": esCtFlag,
  "es-ga": esGaFlag,
  "es-pv": esPvFlag,
  et: etFlag,
  fi: fiFlag,
  fr: frFlag,
  "gb-wls": gbWlsFlag,
  ge: geFlag,
  gr: grFlag,
  hr: hrFlag,
  hu: huFlag,
  id: idFlag,
  ie: ieFlag,
  il: ilFlag,
  in: inFlag,
  ir: irFlag,
  is: isFlag,
  it: itFlag,
  jp: jpFlag,
  kh: khFlag,
  kr: krFlag,
  kz: kzFlag,
  la: laFlag,
  lk: lkFlag,
  lt: ltFlag,
  lv: lvFlag,
  mg: mgFlag,
  mk: mkFlag,
  mm: mmFlag,
  mn: mnFlag,
  my: myFlag,
  nl: nlFlag,
  no: noFlag,
  np: npFlag,
  nz: nzFlag,
  ph: phFlag,
  pk: pkFlag,
  pl: plFlag,
  ro: roFlag,
  rs: rsFlag,
  ru: ruFlag,
  se: seFlag,
  si: siFlag,
  sk: skFlag,
  th: thFlag,
  tr: trFlag,
  tz: tzFlag,
  ua: uaFlag,
  us: usFlag,
  uz: uzFlag,
  vn: vnFlag,
  za: zaFlag,
};
