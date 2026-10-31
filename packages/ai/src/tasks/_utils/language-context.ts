import { type SupportedLocale, getContentLocale } from "@zoonk/utils/locale";

/** Each language teaches one regional variant (`prompt-language.ts`); its pack is that place. */
type LocalContextPack = {
  place: string;
  money: string;
  formats: string;
  names: string;
  places: string;
  everydayLife: string;
  school: string;
  exams: string;
  register: string;
};

/* oxlint-disable eslint/sort-keys -- Each pack reads in the order a writer uses it: where, money, then people and places. */
const LOCAL_CONTEXT_PACKS: Record<SupportedLocale, LocalContextPack> = {
  de: {
    place: "Germany",
    money: "euro, written 1.234,56 €",
    formats:
      "1.234,56 (inside LaTeX math, 1.234{,}56); dates as 27.09.2026; 24-hour clock (14:30 Uhr); metric units and °C",
    names: "Mia, Ben, Emma, Paul, Hannah, Leon, Sophie, Finn, Lena, Jonas",
    places:
      "Berlin, Hamburg, München, Köln, Frankfurt, Stuttgart, Düsseldorf, Leipzig, Dresden, Hannover; the Bäckerei, the Supermarkt, the S-Bahn and U-Bahn, the Deutsche Bahn",
    everydayLife:
      "girocard (EC-Karte) and PayPal, Mehrwertsteuer (19%, 7% reduced), the yearly Steuererklärung, gesetzliche Krankenkasse, Rente, Minijob, Pfand on bottles, the Deutschlandticket",
    school:
      "Grundschule (grades 1 to 4; to 6 in Berlin and Brandenburg), then Gymnasium, Realschule, Hauptschule or Gesamtschule depending on the Land; Abitur after grade 12 or 13; Ausbildung (dual vocational training) or Studium at a Hochschule or Universität; grades from 1 (sehr gut) to 6 (ungenügend)",
    exams:
      "Abitur, Mittlere Reife, Staatsexamen (law, medicine, teaching), IHK final exams of an Ausbildung, the Führerschein theory test, TestDaF and Goethe-Zertifikat",
    register: 'address the reader as "du", informal and friendly',
  },
  en: {
    place: "the United States",
    money: "US dollars, written $1,234.56",
    formats:
      "1,234.56; dates as September 27, 2026 or 9/27/2026; 12-hour clock (3:30 p.m.); miles, pounds, gallons and °F in daily life, metric in science",
    names: "Emma, Liam, Olivia, Noah, Ava, Ethan, Sophia, Jamal, Priya, Diego",
    places:
      "New York, Los Angeles, Chicago, Houston, Phoenix, Philadelphia, Seattle, Atlanta, Miami, Denver; a grocery store, a diner, a gas station, the mall",
    everydayLife:
      "Venmo and Zelle, credit cards and credit scores, sales tax added at the register, tips of 15 to 20 percent, federal and state income tax withheld from paychecks, Tax Day in April, 401(k) and IRA, Social Security, health insurance through an employer, ZIP codes, the DMV",
    school:
      "elementary school (kindergarten to 5th grade), middle school (6th to 8th), high school (9th to 12th grade: freshman, sophomore, junior, senior), then community college or a four-year college; letter grades A to F and a GPA out of 4.0",
    exams:
      "SAT and ACT for college admission, AP exams, GED, GRE, GMAT, LSAT, MCAT, the bar exam, NCLEX, USMLE",
    register: 'address the reader as "you", friendly and direct',
  },
  es: {
    place: "Mexico",
    money: "Mexican peso, written $1,234.56 (MXN where dollars could be meant)",
    formats:
      "1,234.56 (inside LaTeX math, 1{,}234.56); dates as 27/09/2026; 12-hour clock in everyday use (2:30 p.m.); metric units and °C",
    names: "Sofía, Santiago, Valentina, Mateo, Ximena, Diego, Regina, Emiliano, Camila, Luis",
    places:
      "Ciudad de México (CDMX), Guadalajara, Monterrey, Puebla, Mérida, Querétaro, Tijuana, León, Oaxaca, Veracruz; the tiendita on the corner, the mercado and the tianguis, the Metro and the Metrobús, OXXO",
    everydayLife:
      'bank transfers (SPEI), cash at OXXO, buying in "meses sin intereses", IVA (16%), CURP and RFC, the INE voter card as ID, IMSS and ISSSTE, salaries paid every quincena, the aguinaldo (at least 15 days\' pay, by December 20), the yearly declaración anual with the SAT, Afore, Infonavit, Mercado Libre',
    school:
      "preescolar; primaria (6 years, ages 6 to 12); secundaria (3 years, ages 12 to 15); preparatoria or bachillerato (ages 15 to 18); then universidad (licenciatura); grades usually from 5 to 10, where 6 passes",
    exams:
      "university admission exams: the EXANI-II (Ceneval), the UNAM's and the IPN's own (counted in aciertos, correct answers); the EGEL (Ceneval) to graduate, the ENARM for medical residencies, TOEFL and Cambridge exams for English",
    register:
      'address the reader as "tú" (and "ustedes" for a group, never "vosotros" or "vos"), informal and warm, in Latin American Spanish with Mexico\'s vocabulary (computadora, celular, carro, jugo) and no regional slang',
  },
  fr: {
    place: "France",
    money: "euro, written 1 234,56 € (a space between thousands, the symbol after the number)",
    formats:
      "1 234,56 (inside LaTeX math, 1\\,234{,}56); dates as 27/09/2026; 24-hour clock (14 h 30); metric units and °C",
    names: "Léa, Lucas, Emma, Hugo, Chloé, Louis, Inès, Gabriel, Camille, Nathan",
    places:
      "Paris, Lyon, Marseille, Toulouse, Lille, Bordeaux, Nantes, Strasbourg, Nice, Rennes; the boulangerie, the marché, the métro, the SNCF and the TGV",
    everydayLife:
      "carte bancaire, TVA (20% standard rate), Sécurité sociale with the carte Vitale and a mutuelle, the CAF, the SMIC, income tax withheld at source (prélèvement à la source), France Travail",
    school:
      "école maternelle; école élémentaire (CP to CM2, ages 6 to 11); collège (6e to 3e, ages 11 to 15); lycée (seconde, première, terminale, ages 15 to 18); then université, BTS, BUT or classes préparatoires and grandes écoles; grades out of 20, where 10 passes",
    exams:
      "the brevet, the baccalauréat (the bac), Parcoursup for university places, concours (grandes écoles, CRPE and CAPES for teachers, the civil service), the code de la route, DELF",
    register: 'address the reader as "tu", informal and warm',
  },
  it: {
    place: "Italy",
    money: "euro, written 1.234,56 € (the symbol after the number)",
    formats:
      "1.234,56 (inside LaTeX math, 1.234{,}56); dates as 27/09/2026; 24-hour clock (14:30); metric units and °C",
    names:
      "Sofia, Leonardo, Giulia, Francesco, Aurora, Alessandro, Chiara, Lorenzo, Martina, Matteo",
    places:
      "Roma, Milano, Napoli, Torino, Palermo, Genova, Bologna, Firenze, Bari, Catania; the bar for a caffè at the counter, the tabaccheria, the alimentari and the supermercato, the mercato, the metro and the autobus, Trenitalia (the Frecciarossa) and Italo",
    everydayLife:
      "the bancomat (debit card and ATM), contactless payments and Satispay, PagoPA for taxes, fines and school fees, IVA (22% standard rate; 10%, 5% and 4% reduced), the busta paga with tredicesima and TFR, IRPEF and the yearly 730 (often precompilato), codice fiscale and tessera sanitaria, SPID or CIE for public services, INPS and ISEE, partita IVA for freelancers, the coperto on restaurant bills, Esselunga, Coop and Conad",
    school:
      "scuola dell'infanzia (ages 3 to 6); scuola primaria (5 years, ages 6 to 11); scuola secondaria di primo grado, the scuola media (3 years, ages 11 to 14); scuola secondaria di secondo grado (5 years, ages 14 to 19: liceo, istituto tecnico or istituto professionale); then università (laurea triennale, then magistrale) or an ITS Academy; grades from 1 to 10, where 6 passes (primaria uses judgments from ottimo to non sufficiente); the maturità is out of 100, where 60 passes (100 e lode at the top); university exams out of 30, where 18 passes (30 e lode), and the degree out of 110",
    exams:
      "the maturità (officially the esame di maturità again since 2026: two written prove and an oral on four subjects), the esame di terza media, INVALSI tests, test d'ingresso such as CISIA's TOLC, the semestre filtro for medicine, dentistry and veterinary (national exams in chemistry, physics and biology after the first semester), concorsi pubblici (concorso scuola, INPS, Agenzia delle Entrate, forze dell'ordine), the esame di avvocato, the patente B theory quiz (30 true/false questions, at most 3 errors), CILS and CELI",
    register:
      'address the reader as "tu", informal and warm; rephrase anything that would assume the reader\'s gender ("ci sei?" rather than "sei pronto?")',
  },
  ja: {
    place: "Japan",
    money:
      "Japanese yen, written 1,234円 in lessons (¥1,234 on price tags and receipts), never with decimals; large sums with 万 and 億 (3万円, 1億2,000万円); shop prices show the tax-included (税込) total",
    formats:
      "1,234.56 (inside LaTeX math, 1{,}234.56), large numbers often counted in 万 and 億 (12万人); dates as 2026年9月27日 or 2026/9/27, the weekday in brackets (9月27日(日)); 24-hour clock on schedules and timetables (14:30), 午前/午後 in speech (午後2時半); metric units and °C, rooms in 畳; years in the Western calendar, 令和 (令和8年 = 2026) only on official forms and documents",
    names:
      "陽菜, 翔太, 結衣, 大輝, さくら, 拓也, 美咲, 健太, 葵, 蓮; adults call each other by family name + さん (common ones: 佐藤, 鈴木, 高橋, 田中, 伊藤, 渡辺, 山本, 中村, 小林, 加藤), given name + さん, くん or ちゃん for children, close friends and word problems",
    places:
      "東京, 横浜, 大阪, 名古屋, 札幌, 福岡, 神戸, 京都, 仙台, 広島; the コンビニ, the スーパー, the 駅, 電車 and the 新幹線, the 居酒屋, the 100円ショップ, the ドラッグストア",
    everydayLife:
      "cash still common next to credit cards, Suica and PASMO IC cards and QR payments such as PayPay; ポイント cards and apps; 消費税 (10%, 8% reduced on food and non-alcoholic drinks not eaten in, and newspapers); monthly 給料 and the 手取り after 源泉徴収 and 社会保険料, summer and winter ボーナス, 年末調整 done by the employer, 確定申告 (February to March) for freelancers and side income, 住民税; 健康保険 with a 3割 copay and the マイナ保険証, 国民年金 and 厚生年金; マイナンバー; ふるさと納税, 新NISA and iDeCo; 住民票, postal codes as 〒123-4567; LINE",
    school:
      "the school year (and the fiscal 年度) starts in April; 小学校 (1年生 to 6年生, ages 6 to 12), 中学校 (3 years, ages 12 to 15, the end of compulsory school), 高校 (高1 to 高3, ages 15 to 18) or 高専 (5 years); then 大学 (4 years), 短大 (2 years) or 専門学校; 評定 from 1 to 5 in 中学校 and 高校, which makes the 内申点 for 高校入試; 偏差値 (average 50) ranks mock exam results and schools; 塾 and 予備校 after school, 部活; universities admit through 一般選抜 (national and public ones take the 共通テスト plus their own exam, most private ones only their own), 総合型選抜 or 学校推薦型選抜",
    exams:
      "大学入学共通テスト (共通テスト), 高校入試 and 中学受験, 英検, TOEIC L&R, 日商簿記, 宅建, FP技能検定, ITパスポート and 基本情報技術者試験, 公務員試験 (国家公務員 and 地方公務員), 教員採用試験, 司法試験 (and its 予備試験), 医師国家試験 and 看護師国家試験, 漢検, the 運転免許 学科試験",
    register:
      "address the reader in polite です・ます (丁寧語), warm and plain, without heavy keigo (尊敬語, 謙譲語); leave the pronoun out instead of writing あなた (みなさん for a group)",
  },
  ko: {
    place: "South Korea",
    money:
      "South Korean won, written 12,000원 in lessons (₩12,000 only on some menus and signs), never with decimals; large sums with 만 and 억 (5만 원, 3억 5천만 원); prices include VAT",
    formats:
      "1,234.56 (inside LaTeX math, 1{,}234.56), large numbers often counted in 만 and 억 (12만 명); dates as 2026년 9월 27일 or 2026. 9. 27., the weekday in brackets (9월 27일(일)); 12-hour clock with 오전/오후 in daily life (오후 2시 30분), 24-hour on timetables (14:30); metric units and °C, apartments in ㎡ (평 in speech); ages in 만 나이 (international age), the legal standard since 2023",
    names:
      "서연, 민준, 지은, 현우, 수아, 지훈, 민서, 동현, 하은, 도윤; common family names 김, 이, 박, 최, 정; adults use the full or given name + 씨 (김민준 씨, 민준 씨) or a title + 님 at work (박 팀장님), never the family name + 씨 alone; friends use given names",
    places:
      "서울, 부산, 인천, 대구, 대전, 광주, 울산, 수원, 창원, 제주; the 편의점, the 지하철 and 시내버스, the KTX, the PC방, the 동네 카페, the 치킨집, the 아파트 단지, the 전통시장",
    everydayLife:
      "credit and check cards (신용카드, 체크카드) almost everywhere, KakaoPay, Naver Pay, Toss and Samsung Pay, transfers through Toss or KakaoPay to split a bill (더치페이), T-money on buses and the subway; 부가가치세 (10%, included in prices); 연봉 paid as a monthly 월급 after 소득세 and the employee's share of 4대 보험 (국민연금, 건강보험, 고용보험; 산재보험 is all the employer's), 연말정산 in January and February, 종합소득세 신고 in May for freelancers (3.3% withheld) and the self-employed, 성과급 and 명절 상여; 국민건강보험 for everyone; 주민등록번호; 5-digit 우편번호 and 도로명주소; 전세 and 월세, 아파트, delivery apps, 카카오톡, 군 복무 for men",
    school:
      "the school year starts in March; 초등학교 (1 to 6학년, from the March after the year a child turns 6), 중학교 (3 years), 고등학교 (3 years: 일반고, 특목고, 특성화고), written 초3, 중2, 고3; then 대학교 (4 years) or 전문대 (2 to 3 years); middle schools grade A to E; high schools grade A to E plus a relative 내신 등급 from 1 (top 10%) to 5 for students who entered from 2025 (1 to 9 before), under the 고교학점제 credit system; 학원 after school, 과외 and 인강; universities admit through 수시 (school records, essays) and 정시 (수능 scores)",
    exams:
      "수능 (대학수학능력시험, graded 1 to 9 등급 with 표준점수 and 백분위) and 모의고사, 검정고시, 토익, 토익스피킹 and 오픽, 공무원 시험 (9급 and 7급, 국가직 and 지방직), 교원 임용시험, NCS tests for public companies, 공인중개사, 한국사능력검정시험 (한능검), 정보처리기사 and 컴퓨터활용능력 (컴활), 변호사시험, 의사 국가시험 (의사 국시), the 운전면허 필기시험",
    register:
      "address the reader in polite, warm 해요체 (~해요); leave the pronoun out instead of writing 당신 or 너 (여러분 for a group), never 반말, and 합쇼체 (~합니다) only in set phrases such as 감사합니다",
  },
  pl: {
    place: "Poland",
    money: "Polish złoty, written 1234,56 zł or 12 345,67 zł (the symbol after the number)",
    formats:
      "1234,56 and 12 345,67, with a space between thousands only from five digits up (inside LaTeX math, 1234{,}56 and 12\\,345{,}67); dates as 27.09.2026; 24-hour clock (14:30); metric units and °C",
    names: "Zofia, Jakub, Anna, Antoni, Julia, Piotr, Maja, Kacper, Katarzyna, Nikodem",
    places:
      "Warszawa, Kraków, Wrocław, Łódź, Poznań, Gdańsk, Szczecin, Bydgoszcz, Lublin, Katowice; Żabka, Biedronka and Lidl, the osiedle of bloki, the tram, InPost paczkomaty, PKP Intercity and the Pendolino, the bar mleczny, the działka",
    everydayLife:
      "BLIK and contactless cards, VAT (23% standard rate; 8% and 5% reduced), PIT filed by April 30 (Twój e-PIT prepares it for most people), PESEL, ZUS and NFZ, umowa o pracę versus umowa zlecenie or B2B self-employment, płaca minimalna, PPK, L4 sick leave, 800 plus per child, the trzynastka for retirees, mObywatel, Allegro",
    school:
      "przedszkole, with a compulsory zerówka year at 6; szkoła podstawowa (grades 1 to 8, ages 7 to 15); then liceum ogólnokształcące (4 years), technikum (5 years) or szkoła branżowa; then studia: licencjat or inżynier, then magister (law and medicine as 5- or 6-year jednolite studia magisterskie), with places given by matura results; grades from 1 (niedostateczny) to 6 (celujący), where 2 (dopuszczający) passes, with descriptive year-end grades in grades 1 to 3; university grades from 2 to 5, where 3 passes",
    exams:
      "egzamin ósmoklasisty (Polish, math and a foreign language; its scores decide high school places), the matura (Polish, math and a foreign language at the poziom podstawowy, 30% to pass each, plus at least one subject at the poziom rozszerzony), egzamin zawodowy, entrance exams for the aplikacja adwokacka, radcowska and notarialna, LEK and LDEK for doctors and dentists, the egzamin na prawo jazdy at WORD (theory: 32 questions, 68 of 74 points to pass), the państwowy egzamin certyfikatowy z języka polskiego jako obcego",
    register:
      'address the reader as "ty", warm and direct, lowercase mid-sentence ("twój plan"), never "Pan" or "Pani"; prefer present and future forms over past forms and conditionals that reveal gender ("zrobiłeś", "zrobiłaś", "zrobiłbyś"): ask "Co zrobisz?"',
  },
  pt: {
    place: "Brazil",
    money: "Brazilian real, written R$ 1.234,56",
    formats:
      "1.234,56 (inside LaTeX math, 1.234{,}56); dates as 27/09/2026; 24-hour clock (14h30); metric units and °C",
    names: "Ana, João, Maria, Pedro, Juliana, Lucas, Camila, Gabriel, Beatriz, Rafael",
    places:
      "São Paulo, Rio de Janeiro, Belo Horizonte, Salvador, Recife, Fortaleza, Brasília, Curitiba, Porto Alegre, Manaus; the padaria, the feira, the supermercado, the ônibus and the metrô",
    everydayLife:
      'Pix and boleto, installments without interest ("parcelado sem juros"), 13º salário, CLT jobs and FGTS, CPF, SUS, INSS, the yearly Imposto de Renda return, iFood, Mercado Livre',
    school:
      "educação infantil; ensino fundamental (1st to 9th year, ages 6 to 14); ensino médio (3 years, ages 15 to 17); then faculdade or universidade; grades from 0 to 10; public universities admit through the ENEM (Sisu) or a vestibular",
    exams:
      "ENEM, vestibulares (Fuvest, Unicamp), concursos públicos (boards such as Cebraspe, FGV, Vunesp and FCC), the OAB exam, CNU, Revalida",
    register: 'address the reader as "você", warm and informal, the way people speak in Brazil',
  },
  tr: {
    place: "Türkiye",
    money:
      "Turkish lira, written 1.234,56 TL in text; on price tags and in tables the ₺ sign goes before the number with no space (₺1.234,56)",
    formats:
      "1.234,56 (inside LaTeX math, 1.234{,}56); the percent sign before the number (%20; inside LaTeX math, \\%20); dates as 27.09.2026; 24-hour clock (14.30, or 14:30 on screens); metric units and °C",
    names: "Zeynep, Mehmet, Elif, Yusuf, Ayşe, Emre, Defne, Mustafa, Merve, Burak",
    places:
      "İstanbul, Ankara, İzmir, Bursa, Antalya, Konya, Adana, Gaziantep, Mersin, Diyarbakır; the bakkal and chains like BİM, A101 and Migros, the semt pazarı and the çarşı, the dolmuş, İstanbul's metrobüs and vapur, the simitçi and the çay ocağı, intercity buses from the otogar and the YHT high-speed train",
    everydayLife:
      "credit cards with taksit (installments) and Troy cards, IBAN transfers through FAST, KDV (20% standard rate; 10% and 1% reduced), asgari ücret, income tax withheld from pay (a yearly beyanname only for other income), SGK for health insurance and pensions, the 11-digit T.C. kimlik numarası, e-Devlet for public services, e-Nabız and MHRS for doctor appointments, İstanbulkart, Trendyol, Getir and Yemeksepeti, çay at home and at work, prices in tens and hundreds of lira after years of high inflation",
    school:
      "okul öncesi; ilkokul (grades 1 to 4, from about age 6); ortaokul (grades 5 to 8); lise (grades 9 to 12: Anadolu lisesi, fen lisesi, meslek lisesi, imam hatip lisesi), 12 years compulsory (4+4+4); selective lises admit through the LGS; then üniversite: ön lisans (2 years) or lisans (4 years, often after an English hazırlık year), with places assigned through the YKS; grades out of 100, where 50 passes in lise; a karne each term, with a teşekkür belgesi from 70 and a takdir belgesi from 85; university grades from AA to FF on a 4.00 scale",
    exams:
      "YKS for university places (TYT, AYT and YDT, run by ÖSYM), LGS for high school places, KPSS for civil service jobs, MEB-AGS and ÖABT for teaching posts, ALES for graduate study, YDS and YÖKDİL for foreign languages, DGS from ön lisans to lisans, TUS for medical specialty training, HMGS for law careers, the ehliyet e-sınav (50 questions, 70 points to pass) and direksiyon sınavı; students take deneme sınavları (mock exams) all year",
    register:
      'address the reader as "sen", warm and respectful, as Turkish learning apps do; soften instructions ("bakalım", "deneyebilirsin"), skip slang, and never switch to "siz"',
  },
};
/* oxlint-enable eslint/sort-keys */

function formatPack(pack: LocalContextPack): string {
  return [
    `- Place: ${pack.place}`,
    `- Money: ${pack.money}`,
    `- Numbers, dates and units: ${pack.formats}`,
    `- Common first names: ${pack.names}`,
    `- Cities and places: ${pack.places}`,
    `- Everyday life: ${pack.everydayLife}`,
    `- School: ${pack.school}`,
    `- National exams: ${pack.exams}`,
    `- Register: ${pack.register}`,
    "- Brands: real companies and brands, the ones above included, appear only in their ordinary use; a failure, a bug, a complaint or a mistake happens at a made-up company with a made-up name",
  ].join("\n");
}

/**
 * A default, not a rule: prompts let the goal set another place (the SAT is American whatever the
 * learner's language). Languages without a pack get "none".
 */
export function formatLocalContext(language: string): string {
  const locale = getContentLocale(language);

  if (!locale) {
    return "LOCAL_CONTEXT: none";
  }

  return `LOCAL_CONTEXT:\n${formatPack(LOCAL_CONTEXT_PACKS[locale])}`;
}
