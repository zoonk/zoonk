defmodule Zoonk.Locations.CountryData do
  @moduledoc false

  alias Zoonk.Locations.Country
  alias Zoonk.Locations.Currency

  @countries [
    %Country{
      iso2: "AD",
      iso3: "AND",
      name: "Andorra",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "AE",
      iso3: "ARE",
      name: "الإمارات العربية المتحدة",
      currency: %Currency{code: "AED", name: "UAE Dirham", symbol: "د.إ"}
    },
    %Country{
      iso2: "AF",
      iso3: "AFG",
      name: "افغانستان",
      currency: %Currency{code: "AFN", name: "Afghan Afghani", symbol: "؋"}
    },
    %Country{
      iso2: "AG",
      iso3: "ATG",
      name: "Antigua and Barbuda",
      currency: %Currency{code: "XCD", name: "East Caribbean Dollar", symbol: "$"}
    },
    %Country{
      iso2: "AI",
      iso3: "AIA",
      name: "Anguilla",
      currency: %Currency{code: "XCD", name: "East Caribbean Dollar", symbol: "$"}
    },
    %Country{
      iso2: "AL",
      iso3: "ALB",
      name: "Shqipëria",
      currency: %Currency{code: "ALL", name: "Albanian Lek", symbol: "L"}
    },
    %Country{
      iso2: "AM",
      iso3: "ARM",
      name: "Հայաստան",
      currency: %Currency{code: "AMD", name: "Armenian Dram", symbol: "֏"}
    },
    %Country{
      iso2: "AO",
      iso3: "AGO",
      name: "Angola",
      currency: %Currency{code: "AOA", name: "Angolan Kwanza", symbol: "Kz"}
    },
    %Country{
      iso2: "AQ",
      iso3: "ATA",
      name: "Antarctica",
      currency: %Currency{code: "USD", name: "United States Dollar", symbol: "$"}
    },
    %Country{
      iso2: "AR",
      iso3: "ARG",
      name: "Argentina",
      currency: %Currency{code: "ARS", name: "Argentine Peso", symbol: "$"}
    },
    %Country{
      iso2: "AS",
      iso3: "ASM",
      name: "American Samoa",
      currency: %Currency{code: "USD", name: "United States Dollar", symbol: "$"}
    },
    %Country{
      iso2: "AT",
      iso3: "AUT",
      name: "Österreich",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "AU",
      iso3: "AUS",
      name: "Australia",
      currency: %Currency{code: "AUD", name: "Australian Dollar", symbol: "$"}
    },
    %Country{
      iso2: "AW",
      iso3: "ABW",
      name: "Aruba",
      currency: %Currency{code: "AWG", name: "Aruban Florin", symbol: "ƒ"}
    },
    %Country{
      iso2: "AX",
      iso3: "ALA",
      name: "Åland",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "AZ",
      iso3: "AZE",
      name: "Azərbaycan",
      currency: %Currency{code: "AZN", name: "Azerbaijani Manat", symbol: "₼"}
    },
    %Country{
      iso2: "BA",
      iso3: "BIH",
      name: "Bosna i Hercegovina",
      currency: %Currency{code: "BAM", name: "Bosnia and Herzegovina Convertible Mark", symbol: "KM"}
    },
    %Country{
      iso2: "BB",
      iso3: "BRB",
      name: "Barbados",
      currency: %Currency{code: "BBD", name: "Barbadian Dollar", symbol: "$"}
    },
    %Country{
      iso2: "BD",
      iso3: "BGD",
      name: "বাংলাদেশ",
      currency: %Currency{code: "BDT", name: "Bangladeshi Taka", symbol: "৳"}
    },
    %Country{
      iso2: "BE",
      iso3: "BEL",
      name: "België",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "BF",
      iso3: "BFA",
      name: "Burkina Faso",
      currency: %Currency{code: "XOF", name: "West African CFA Franc", symbol: "CFA"}
    },
    %Country{
      iso2: "BG",
      iso3: "BGR",
      name: "България",
      currency: %Currency{code: "BGN", name: "Bulgarian Lev", symbol: "лв"}
    },
    %Country{
      iso2: "BH",
      iso3: "BHR",
      name: "البحرين",
      currency: %Currency{code: "BHD", name: "Bahraini Dinar", symbol: ".د.ب"}
    },
    %Country{
      iso2: "BI",
      iso3: "BDI",
      name: "Burundi",
      currency: %Currency{code: "BIF", name: "Burundian Franc", symbol: "FBu"}
    },
    %Country{
      iso2: "BJ",
      iso3: "BEN",
      name: "Bénin",
      currency: %Currency{code: "XOF", name: "West African CFA Franc", symbol: "CFA"}
    },
    %Country{
      iso2: "BL",
      iso3: "BLM",
      name: "Saint-Barthélemy",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "BM",
      iso3: "BMU",
      name: "Bermuda",
      currency: %Currency{code: "BMD", name: "Bermudian Dollar", symbol: "$"}
    },
    %Country{
      iso2: "BN",
      iso3: "BRN",
      name: "Brunei Darussalam",
      currency: %Currency{code: "BND", name: "Brunei Dollar", symbol: "$"}
    },
    %Country{
      iso2: "BO",
      iso3: "BOL",
      name: "Bolivia",
      currency: %Currency{code: "BOB", name: "Bolivian Boliviano", symbol: "Bs."}
    },
    %Country{
      iso2: "BQ",
      iso3: "BES",
      name: "Bonaire, Sint Eustatius en Saba",
      currency: %Currency{code: "USD", name: "United States Dollar", symbol: "$"}
    },
    %Country{
      iso2: "BR",
      iso3: "BRA",
      name: "Brasil",
      currency: %Currency{code: "BRL", name: "Real Brasileiro", symbol: "R$"}
    },
    %Country{
      iso2: "BS",
      iso3: "BHS",
      name: "Bahamas",
      currency: %Currency{code: "BSD", name: "Bahamian Dollar", symbol: "$"}
    },
    %Country{
      iso2: "BT",
      iso3: "BTN",
      name: "འབྲུག་ཡུལ་",
      currency: %Currency{code: "BTN", name: "Bhutanese Ngultrum", symbol: "Nu."}
    },
    %Country{
      iso2: "BV",
      iso3: "BVT",
      name: "Bouvet Island",
      currency: %Currency{code: "NOK", name: "Norwegian Krone", symbol: "kr"}
    },
    %Country{
      iso2: "BW",
      iso3: "BWA",
      name: "Botswana",
      currency: %Currency{code: "BWP", name: "Botswana Pula", symbol: "P"}
    },
    %Country{
      iso2: "BY",
      iso3: "BLR",
      name: "Беларусь",
      currency: %Currency{code: "BYN", name: "Belarusian Ruble", symbol: "Br"}
    },
    %Country{
      iso2: "BZ",
      iso3: "BLZ",
      name: "Belize",
      currency: %Currency{code: "BZD", name: "Belize Dollar", symbol: "$"}
    },
    %Country{
      iso2: "CA",
      iso3: "CAN",
      name: "Canada",
      currency: %Currency{code: "CAD", name: "Canadian Dollar", symbol: "$"}
    },
    %Country{
      iso2: "CC",
      iso3: "CCK",
      name: "Cocos (Keeling) Islands",
      currency: %Currency{code: "AUD", name: "Australian Dollar", symbol: "$"}
    },
    %Country{
      iso2: "CD",
      iso3: "COD",
      name: "République démocratique du Congo",
      currency: %Currency{code: "CDF", name: "Congolese Franc", symbol: "FC"}
    },
    %Country{
      iso2: "CF",
      iso3: "CAF",
      name: "République centrafricaine",
      currency: %Currency{code: "XAF", name: "Central African CFA Franc", symbol: "FCFA"}
    },
    %Country{
      iso2: "CG",
      iso3: "COG",
      name: "République du Congo",
      currency: %Currency{code: "XAF", name: "Central African CFA Franc", symbol: "FCFA"}
    },
    %Country{
      iso2: "CH",
      iso3: "CHE",
      name: "Schweiz",
      currency: %Currency{code: "CHF", name: "Swiss Franc", symbol: "Fr."}
    },
    %Country{
      iso2: "CI",
      iso3: "CIV",
      name: "Côte d'Ivoire",
      currency: %Currency{code: "XOF", name: "West African CFA Franc", symbol: "CFA"}
    },
    %Country{
      iso2: "CK",
      iso3: "COK",
      name: "Cook Islands",
      currency: %Currency{code: "NZD", name: "New Zealand Dollar", symbol: "$"}
    },
    %Country{
      iso2: "CL",
      iso3: "CHL",
      name: "Chile",
      currency: %Currency{code: "CLP", name: "Peso Chileno", symbol: "$"}
    },
    %Country{
      iso2: "CM",
      iso3: "CMR",
      name: "Cameroun",
      currency: %Currency{code: "XAF", name: "Central African CFA Franc", symbol: "FCFA"}
    },
    %Country{
      iso2: "CN",
      iso3: "CHN",
      name: "中华人民共和国",
      currency: %Currency{code: "CNY", name: "人民币", symbol: "¥"}
    },
    %Country{
      iso2: "CO",
      iso3: "COL",
      name: "Colombia",
      currency: %Currency{code: "COP", name: "Colombian Peso", symbol: "$"}
    },
    %Country{
      iso2: "CR",
      iso3: "CRI",
      name: "Costa Rica",
      currency: %Currency{code: "CRC", name: "Costa Rican Colón", symbol: "₡"}
    },
    %Country{
      iso2: "CU",
      iso3: "CUB",
      name: "Cuba",
      currency: %Currency{code: "CUP", name: "Cuban Peso", symbol: "$"}
    },
    %Country{
      iso2: "CV",
      iso3: "CPV",
      name: "Cabo Verde",
      currency: %Currency{code: "CVE", name: "Cape Verdean Escudo", symbol: "$"}
    },
    %Country{
      iso2: "CW",
      iso3: "CUW",
      name: "Curaçao",
      currency: %Currency{code: "ANG", name: "Netherlands Antillean Guilder", symbol: "ƒ"}
    },
    %Country{
      iso2: "CX",
      iso3: "CXR",
      name: "Christmas Island",
      currency: %Currency{code: "AUD", name: "Australian Dollar", symbol: "$"}
    },
    %Country{
      iso2: "CY",
      iso3: "CYP",
      name: "Κύπρος",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "CZ",
      iso3: "CZE",
      name: "Česká republika",
      currency: %Currency{code: "CZK", name: "Czech Koruna", symbol: "Kč"}
    },
    %Country{
      iso2: "DE",
      iso3: "DEU",
      name: "Deutschland",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "DJ",
      iso3: "DJI",
      name: "Djibouti",
      currency: %Currency{code: "DJF", name: "Djiboutian Franc", symbol: "Fdj"}
    },
    %Country{
      iso2: "DK",
      iso3: "DNK",
      name: "Danmark",
      currency: %Currency{code: "DKK", name: "Danish Krone", symbol: "kr"}
    },
    %Country{
      iso2: "DM",
      iso3: "DMA",
      name: "Dominica",
      currency: %Currency{code: "XCD", name: "East Caribbean Dollar", symbol: "$"}
    },
    %Country{
      iso2: "DO",
      iso3: "DOM",
      name: "República Dominicana",
      currency: %Currency{code: "DOP", name: "Dominican Peso", symbol: "$"}
    },
    %Country{
      iso2: "DZ",
      iso3: "DZA",
      name: "الجزائر",
      currency: %Currency{code: "DZD", name: "Algerian Dinar", symbol: "دج"}
    },
    %Country{
      iso2: "EC",
      iso3: "ECU",
      name: "Ecuador",
      currency: %Currency{code: "USD", name: "United States Dollar", symbol: "$"}
    },
    %Country{
      iso2: "EE",
      iso3: "EST",
      name: "Eesti",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "EG",
      iso3: "EGY",
      name: "مصر",
      currency: %Currency{code: "EGP", name: "Egyptian Pound", symbol: "ج.م"}
    },
    %Country{
      iso2: "EH",
      iso3: "ESH",
      name: "الصحراء الغربية",
      currency: %Currency{code: "MAD", name: "Moroccan Dirham", symbol: "د.م."}
    },
    %Country{
      iso2: "ER",
      iso3: "ERI",
      name: "ኤርትራ",
      currency: %Currency{code: "ERN", name: "Eritrean Nakfa", symbol: "Nfk"}
    },
    %Country{
      iso2: "ES",
      iso3: "ESP",
      name: "España",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "ET",
      iso3: "ETH",
      name: "ኢትዮጵያ",
      currency: %Currency{code: "ETB", name: "Ethiopian Birr", symbol: "Br"}
    },
    %Country{
      iso2: "FI",
      iso3: "FIN",
      name: "Suomi",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "FJ",
      iso3: "FJI",
      name: "Fiji",
      currency: %Currency{code: "FJD", name: "Fijian Dollar", symbol: "$"}
    },
    %Country{
      iso2: "FK",
      iso3: "FLK",
      name: "Falkland Islands",
      currency: %Currency{code: "FKP", name: "Falkland Islands Pound", symbol: "£"}
    },
    %Country{
      iso2: "FM",
      iso3: "FSM",
      name: "Micronesia",
      currency: %Currency{code: "USD", name: "United States Dollar", symbol: "$"}
    },
    %Country{
      iso2: "FO",
      iso3: "FRO",
      name: "Føroyar",
      currency: %Currency{code: "DKK", name: "Danish Krone", symbol: "kr"}
    },
    %Country{
      iso2: "FR",
      iso3: "FRA",
      name: "France",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "GA",
      iso3: "GAB",
      name: "Gabon",
      currency: %Currency{code: "XAF", name: "Central African CFA Franc", symbol: "FCFA"}
    },
    %Country{
      iso2: "GB",
      iso3: "GBR",
      name: "United Kingdom",
      currency: %Currency{code: "GBP", name: "British Pound Sterling", symbol: "£"}
    },
    %Country{
      iso2: "GD",
      iso3: "GRD",
      name: "Grenada",
      currency: %Currency{code: "XCD", name: "East Caribbean Dollar", symbol: "$"}
    },
    %Country{
      iso2: "GE",
      iso3: "GEO",
      name: "საქართველო",
      currency: %Currency{code: "GEL", name: "Georgian Lari", symbol: "₾"}
    },
    %Country{
      iso2: "GF",
      iso3: "GUF",
      name: "Guyane française",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "GG",
      iso3: "GGY",
      name: "Guernsey",
      currency: %Currency{code: "GBP", name: "British Pound Sterling", symbol: "£"}
    },
    %Country{
      iso2: "GH",
      iso3: "GHA",
      name: "Ghana",
      currency: %Currency{code: "GHS", name: "Ghanaian Cedi", symbol: "₵"}
    },
    %Country{
      iso2: "GI",
      iso3: "GIB",
      name: "Gibraltar",
      currency: %Currency{code: "GIP", name: "Gibraltar Pound", symbol: "£"}
    },
    %Country{
      iso2: "GL",
      iso3: "GRL",
      name: "Kalaallit Nunaat",
      currency: %Currency{code: "DKK", name: "Danish Krone", symbol: "kr"}
    },
    %Country{
      iso2: "GM",
      iso3: "GMB",
      name: "Gambia",
      currency: %Currency{code: "GMD", name: "Gambian Dalasi", symbol: "D"}
    },
    %Country{
      iso2: "GN",
      iso3: "GIN",
      name: "Guinée",
      currency: %Currency{code: "GNF", name: "Guinean Franc", symbol: "FG"}
    },
    %Country{
      iso2: "GP",
      iso3: "GLP",
      name: "Guadeloupe",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "GQ",
      iso3: "GNQ",
      name: "Guinea Ecuatorial",
      currency: %Currency{code: "XAF", name: "Central African CFA Franc", symbol: "FCFA"}
    },
    %Country{
      iso2: "GR",
      iso3: "GRC",
      name: "Ελλάδα",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "GS",
      iso3: "SGS",
      name: "South Georgia and the South Sandwich Islands",
      currency: %Currency{code: "GBP", name: "British Pound Sterling", symbol: "£"}
    },
    %Country{
      iso2: "GT",
      iso3: "GTM",
      name: "Guatemala",
      currency: %Currency{code: "GTQ", name: "Guatemalan Quetzal", symbol: "Q"}
    },
    %Country{
      iso2: "GU",
      iso3: "GUM",
      name: "Guam",
      currency: %Currency{code: "USD", name: "United States Dollar", symbol: "$"}
    },
    %Country{
      iso2: "GW",
      iso3: "GNB",
      name: "Guiné-Bissau",
      currency: %Currency{code: "XOF", name: "West African CFA Franc", symbol: "CFA"}
    },
    %Country{
      iso2: "GY",
      iso3: "GUY",
      name: "Guyana",
      currency: %Currency{code: "GYD", name: "Guyanese Dollar", symbol: "$"}
    },
    %Country{
      iso2: "HK",
      iso3: "HKG",
      name: "香港",
      currency: %Currency{code: "HKD", name: "Hong Kong Dollar", symbol: "$"}
    },
    %Country{
      iso2: "HM",
      iso3: "HMD",
      name: "Heard Island and McDonald Islands",
      currency: %Currency{code: "AUD", name: "Australian Dollar", symbol: "$"}
    },
    %Country{
      iso2: "HN",
      iso3: "HND",
      name: "Honduras",
      currency: %Currency{code: "HNL", name: "Honduran Lempira", symbol: "L"}
    },
    %Country{
      iso2: "HR",
      iso3: "HRV",
      name: "Hrvatska",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "HT",
      iso3: "HTI",
      name: "Haïti",
      currency: %Currency{code: "HTG", name: "Haitian Gourde", symbol: "G"}
    },
    %Country{
      iso2: "HU",
      iso3: "HUN",
      name: "Magyarország",
      currency: %Currency{code: "HUF", name: "Hungarian Forint", symbol: "Ft"}
    },
    %Country{
      iso2: "ID",
      iso3: "IDN",
      name: "Indonesia",
      currency: %Currency{code: "IDR", name: "Indonesian Rupiah", symbol: "Rp"}
    },
    %Country{
      iso2: "IE",
      iso3: "IRL",
      name: "Éire",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "IL",
      iso3: "ISR",
      name: "ישראל",
      currency: %Currency{code: "ILS", name: "Israeli New Shekel", symbol: "₪"}
    },
    %Country{
      iso2: "IM",
      iso3: "IMN",
      name: "Isle of Man",
      currency: %Currency{code: "GBP", name: "British Pound Sterling", symbol: "£"}
    },
    %Country{
      iso2: "IN",
      iso3: "IND",
      name: "भारत",
      currency: %Currency{code: "INR", name: "Indian Rupee", symbol: "₹"}
    },
    %Country{
      iso2: "IO",
      iso3: "IOT",
      name: "British Indian Ocean Territory",
      currency: %Currency{code: "USD", name: "United States Dollar", symbol: "$"}
    },
    %Country{
      iso2: "IQ",
      iso3: "IRQ",
      name: "العراق",
      currency: %Currency{code: "IQD", name: "Iraqi Dinar", symbol: "ع.د"}
    },
    %Country{
      iso2: "IR",
      iso3: "IRN",
      name: "ایران",
      currency: %Currency{code: "IRR", name: "Iranian Rial", symbol: "﷼"}
    },
    %Country{
      iso2: "IS",
      iso3: "ISL",
      name: "Ísland",
      currency: %Currency{code: "ISK", name: "Icelandic Króna", symbol: "kr"}
    },
    %Country{
      iso2: "IT",
      iso3: "ITA",
      name: "Italia",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "JE",
      iso3: "JEY",
      name: "Jersey",
      currency: %Currency{code: "GBP", name: "British Pound Sterling", symbol: "£"}
    },
    %Country{
      iso2: "JM",
      iso3: "JAM",
      name: "Jamaica",
      currency: %Currency{code: "JMD", name: "Jamaican Dollar", symbol: "$"}
    },
    %Country{
      iso2: "JO",
      iso3: "JOR",
      name: "الأردن",
      currency: %Currency{code: "JOD", name: "Jordanian Dinar", symbol: "د.ا"}
    },
    %Country{
      iso2: "JP",
      iso3: "JPN",
      name: "日本",
      currency: %Currency{code: "JPY", name: "日本円", symbol: "¥"}
    },
    %Country{
      iso2: "KE",
      iso3: "KEN",
      name: "Kenya",
      currency: %Currency{code: "KES", name: "Kenyan Shilling", symbol: "KSh"}
    },
    %Country{
      iso2: "KG",
      iso3: "KGZ",
      name: "Кыргызстан",
      currency: %Currency{code: "KGS", name: "Kyrgyzstani Som", symbol: "лв"}
    },
    %Country{
      iso2: "KH",
      iso3: "KHM",
      name: "កម្ពុជា",
      currency: %Currency{code: "KHR", name: "Cambodian Riel", symbol: "៛"}
    },
    %Country{
      iso2: "KI",
      iso3: "KIR",
      name: "Kiribati",
      currency: %Currency{code: "AUD", name: "Australian Dollar", symbol: "$"}
    },
    %Country{
      iso2: "KM",
      iso3: "COM",
      name: "Comores",
      currency: %Currency{code: "KMF", name: "Comorian Franc", symbol: "CF"}
    },
    %Country{
      iso2: "KN",
      iso3: "KNA",
      name: "Saint Kitts and Nevis",
      currency: %Currency{code: "XCD", name: "East Caribbean Dollar", symbol: "$"}
    },
    %Country{
      iso2: "KP",
      iso3: "PRK",
      name: "조선민주주의인민공화국",
      currency: %Currency{code: "KPW", name: "North Korean Won", symbol: "₩"}
    },
    %Country{
      iso2: "KR",
      iso3: "KOR",
      name: "대한민국",
      currency: %Currency{code: "KRW", name: "대한민국 원", symbol: "₩"}
    },
    %Country{
      iso2: "KW",
      iso3: "KWT",
      name: "الكويت",
      currency: %Currency{code: "KWD", name: "Kuwaiti Dinar", symbol: "د.ك"}
    },
    %Country{
      iso2: "KY",
      iso3: "CYM",
      name: "Cayman Islands",
      currency: %Currency{code: "KYD", name: "Cayman Islands Dollar", symbol: "$"}
    },
    %Country{
      iso2: "KZ",
      iso3: "KAZ",
      name: "Қазақстан",
      currency: %Currency{code: "KZT", name: "Kazakhstani Tenge", symbol: "₸"}
    },
    %Country{
      iso2: "LA",
      iso3: "LAO",
      name: "ລາວ",
      currency: %Currency{code: "LAK", name: "Lao Kip", symbol: "₭"}
    },
    %Country{
      iso2: "LB",
      iso3: "LBN",
      name: "لبنان",
      currency: %Currency{code: "LBP", name: "Lebanese Pound", symbol: "ل.ل"}
    },
    %Country{
      iso2: "LC",
      iso3: "LCA",
      name: "Saint Lucia",
      currency: %Currency{code: "XCD", name: "East Caribbean Dollar", symbol: "$"}
    },
    %Country{
      iso2: "LI",
      iso3: "LIE",
      name: "Liechtenstein",
      currency: %Currency{code: "CHF", name: "Swiss Franc", symbol: "Fr."}
    },
    %Country{
      iso2: "LK",
      iso3: "LKA",
      name: "ශ්‍රී ලංකාව",
      currency: %Currency{code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs"}
    },
    %Country{
      iso2: "LR",
      iso3: "LBR",
      name: "Liberia",
      currency: %Currency{code: "LRD", name: "Liberian Dollar", symbol: "$"}
    },
    %Country{
      iso2: "LS",
      iso3: "LSO",
      name: "Lesotho",
      currency: %Currency{code: "LSL", name: "Lesotho Loti", symbol: "L"}
    },
    %Country{
      iso2: "LT",
      iso3: "LTU",
      name: "Lietuva",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "LU",
      iso3: "LUX",
      name: "Luxembourg",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "LV",
      iso3: "LVA",
      name: "Latvija",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "LY",
      iso3: "LBY",
      name: "ليبيا",
      currency: %Currency{code: "LYD", name: "Libyan Dinar", symbol: "ل.د"}
    },
    %Country{
      iso2: "MA",
      iso3: "MAR",
      name: "المغرب",
      currency: %Currency{code: "MAD", name: "Moroccan Dirham", symbol: "د.م."}
    },
    %Country{
      iso2: "MC",
      iso3: "MCO",
      name: "Monaco",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "MD",
      iso3: "MDA",
      name: "Moldova",
      currency: %Currency{code: "MDL", name: "Moldovan Leu", symbol: "L"}
    },
    %Country{
      iso2: "ME",
      iso3: "MNE",
      name: "Crna Gora",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "MF",
      iso3: "MAF",
      name: "Saint-Martin",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "MG",
      iso3: "MDG",
      name: "Madagasikara",
      currency: %Currency{code: "MGA", name: "Malagasy Ariary", symbol: "Ar"}
    },
    %Country{
      iso2: "MH",
      iso3: "MHL",
      name: "Marshall Islands",
      currency: %Currency{code: "USD", name: "United States Dollar", symbol: "$"}
    },
    %Country{
      iso2: "MK",
      iso3: "MKD",
      name: "Северна Македонија",
      currency: %Currency{code: "MKD", name: "Macedonian Denar", symbol: "ден"}
    },
    %Country{
      iso2: "ML",
      iso3: "MLI",
      name: "Mali",
      currency: %Currency{code: "XOF", name: "West African CFA Franc", symbol: "CFA"}
    },
    %Country{
      iso2: "MM",
      iso3: "MMR",
      name: "မြန်မာ",
      currency: %Currency{code: "MMK", name: "Myanmar Kyat", symbol: "K"}
    },
    %Country{
      iso2: "MN",
      iso3: "MNG",
      name: "Монгол",
      currency: %Currency{code: "MNT", name: "Mongolian Tugrik", symbol: "₮"}
    },
    %Country{
      iso2: "MO",
      iso3: "MAC",
      name: "澳門",
      currency: %Currency{code: "MOP", name: "Macanese Pataca", symbol: "P"}
    },
    %Country{
      iso2: "MP",
      iso3: "MNP",
      name: "Northern Mariana Islands",
      currency: %Currency{code: "USD", name: "United States Dollar", symbol: "$"}
    },
    %Country{
      iso2: "MQ",
      iso3: "MTQ",
      name: "Martinique",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "MR",
      iso3: "MRT",
      name: "موريتانيا",
      currency: %Currency{code: "MRU", name: "Mauritanian Ouguiya", symbol: "UM"}
    },
    %Country{
      iso2: "MS",
      iso3: "MSR",
      name: "Montserrat",
      currency: %Currency{code: "XCD", name: "East Caribbean Dollar", symbol: "$"}
    },
    %Country{
      iso2: "MT",
      iso3: "MLT",
      name: "Malta",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "MU",
      iso3: "MUS",
      name: "Mauritius",
      currency: %Currency{code: "MUR", name: "Mauritian Rupee", symbol: "₨"}
    },
    %Country{
      iso2: "MV",
      iso3: "MDV",
      name: "Maldives",
      currency: %Currency{code: "MVR", name: "Maldivian Rufiyaa", symbol: "Rf"}
    },
    %Country{
      iso2: "MW",
      iso3: "MWI",
      name: "Malawi",
      currency: %Currency{code: "MWK", name: "Malawian Kwacha", symbol: "MK"}
    },
    %Country{
      iso2: "MX",
      iso3: "MEX",
      name: "México",
      currency: %Currency{code: "MXN", name: "Peso Mexicano", symbol: "$"}
    },
    %Country{
      iso2: "MY",
      iso3: "MYS",
      name: "Malaysia",
      currency: %Currency{code: "MYR", name: "Malaysian Ringgit", symbol: "RM"}
    },
    %Country{
      iso2: "MZ",
      iso3: "MOZ",
      name: "Moçambique",
      currency: %Currency{code: "MZN", name: "Mozambican Metical", symbol: "MT"}
    },
    %Country{
      iso2: "NA",
      iso3: "NAM",
      name: "Namibia",
      currency: %Currency{code: "NAD", name: "Namibian Dollar", symbol: "$"}
    },
    %Country{
      iso2: "NC",
      iso3: "NCL",
      name: "Nouvelle-Calédonie",
      currency: %Currency{code: "XPF", name: "CFP Franc", symbol: "₣"}
    },
    %Country{
      iso2: "NE",
      iso3: "NER",
      name: "Niger",
      currency: %Currency{code: "XOF", name: "West African CFA Franc", symbol: "CFA"}
    },
    %Country{
      iso2: "NF",
      iso3: "NFK",
      name: "Norfolk Island",
      currency: %Currency{code: "AUD", name: "Australian Dollar", symbol: "$"}
    },
    %Country{
      iso2: "NG",
      iso3: "NGA",
      name: "Nigeria",
      currency: %Currency{code: "NGN", name: "Nigerian Naira", symbol: "₦"}
    },
    %Country{
      iso2: "NI",
      iso3: "NIC",
      name: "Nicaragua",
      currency: %Currency{code: "NIO", name: "Nicaraguan Córdoba", symbol: "C$"}
    },
    %Country{
      iso2: "NL",
      iso3: "NLD",
      name: "Nederland",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "NO",
      iso3: "NOR",
      name: "Norge",
      currency: %Currency{code: "NOK", name: "Norwegian Krone", symbol: "kr"}
    },
    %Country{
      iso2: "NP",
      iso3: "NPL",
      name: "नेपाल",
      currency: %Currency{code: "NPR", name: "Nepalese Rupee", symbol: "₨"}
    },
    %Country{
      iso2: "NR",
      iso3: "NRU",
      name: "Nauru",
      currency: %Currency{code: "AUD", name: "Australian Dollar", symbol: "$"}
    },
    %Country{
      iso2: "NU",
      iso3: "NIU",
      name: "Niue",
      currency: %Currency{code: "NZD", name: "New Zealand Dollar", symbol: "$"}
    },
    %Country{
      iso2: "NZ",
      iso3: "NZL",
      name: "New Zealand",
      currency: %Currency{code: "NZD", name: "New Zealand Dollar", symbol: "$"}
    },
    %Country{
      iso2: "OM",
      iso3: "OMN",
      name: "عُمان",
      currency: %Currency{code: "OMR", name: "Omani Rial", symbol: "ر.ع."}
    },
    %Country{
      iso2: "PA",
      iso3: "PAN",
      name: "Panamá",
      currency: %Currency{code: "PAB", name: "Panamanian Balboa", symbol: "B/."}
    },
    %Country{
      iso2: "PE",
      iso3: "PER",
      name: "Perú",
      currency: %Currency{code: "PEN", name: "Peruvian Sol", symbol: "S/"}
    },
    %Country{
      iso2: "PF",
      iso3: "PYF",
      name: "Polynésie française",
      currency: %Currency{code: "XPF", name: "CFP Franc", symbol: "₣"}
    },
    %Country{
      iso2: "PG",
      iso3: "PNG",
      name: "Papua New Guinea",
      currency: %Currency{code: "PGK", name: "Papua New Guinean Kina", symbol: "K"}
    },
    %Country{
      iso2: "PH",
      iso3: "PHL",
      name: "Pilipinas",
      currency: %Currency{code: "PHP", name: "Philippine Peso", symbol: "₱"}
    },
    %Country{
      iso2: "PK",
      iso3: "PAK",
      name: "پاکستان",
      currency: %Currency{code: "PKR", name: "Pakistani Rupee", symbol: "₨"}
    },
    %Country{
      iso2: "PL",
      iso3: "POL",
      name: "Polska",
      currency: %Currency{code: "PLN", name: "Polish Złoty", symbol: "zł"}
    },
    %Country{
      iso2: "PM",
      iso3: "SPM",
      name: "Saint-Pierre-et-Miquelon",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "PN",
      iso3: "PCN",
      name: "Pitcairn Islands",
      currency: %Currency{code: "NZD", name: "New Zealand Dollar", symbol: "$"}
    },
    %Country{
      iso2: "PR",
      iso3: "PRI",
      name: "Puerto Rico",
      currency: %Currency{code: "USD", name: "United States Dollar", symbol: "$"}
    },
    %Country{
      iso2: "PS",
      iso3: "PSE",
      name: "فلسطين",
      currency: %Currency{code: "ILS", name: "Israeli New Shekel", symbol: "₪"}
    },
    %Country{
      iso2: "PT",
      iso3: "PRT",
      name: "Portugal",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "PW",
      iso3: "PLW",
      name: "Palau",
      currency: %Currency{code: "USD", name: "United States Dollar", symbol: "$"}
    },
    %Country{
      iso2: "PY",
      iso3: "PRY",
      name: "Paraguay",
      currency: %Currency{code: "PYG", name: "Paraguayan Guaraní", symbol: "₲"}
    },
    %Country{
      iso2: "QA",
      iso3: "QAT",
      name: "قطر",
      currency: %Currency{code: "QAR", name: "Qatari Riyal", symbol: "ر.ق"}
    },
    %Country{
      iso2: "RE",
      iso3: "REU",
      name: "La Réunion",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "RO",
      iso3: "ROU",
      name: "România",
      currency: %Currency{code: "RON", name: "Romanian Leu", symbol: "lei"}
    },
    %Country{
      iso2: "RS",
      iso3: "SRB",
      name: "Србија",
      currency: %Currency{code: "RSD", name: "Serbian Dinar", symbol: "дин"}
    },
    %Country{
      iso2: "RU",
      iso3: "RUS",
      name: "Россия",
      currency: %Currency{code: "RUB", name: "Russian Ruble", symbol: "₽"}
    },
    %Country{
      iso2: "RW",
      iso3: "RWA",
      name: "Rwanda",
      currency: %Currency{code: "RWF", name: "Rwandan Franc", symbol: "FRw"}
    },
    %Country{
      iso2: "SA",
      iso3: "SAU",
      name: "العربية السعودية",
      currency: %Currency{code: "SAR", name: "Saudi Riyal", symbol: "ر.س"}
    },
    %Country{
      iso2: "SB",
      iso3: "SLB",
      name: "Solomon Islands",
      currency: %Currency{code: "SBD", name: "Solomon Islands Dollar", symbol: "$"}
    },
    %Country{
      iso2: "SC",
      iso3: "SYC",
      name: "Seychelles",
      currency: %Currency{code: "SCR", name: "Seychellois Rupee", symbol: "₨"}
    },
    %Country{
      iso2: "SD",
      iso3: "SDN",
      name: "السودان",
      currency: %Currency{code: "SDG", name: "Sudanese Pound", symbol: "ج.س"}
    },
    %Country{
      iso2: "SE",
      iso3: "SWE",
      name: "Sverige",
      currency: %Currency{code: "SEK", name: "Swedish Krona", symbol: "kr"}
    },
    %Country{
      iso2: "SG",
      iso3: "SGP",
      name: "Singapore",
      currency: %Currency{code: "SGD", name: "Singapore Dollar", symbol: "$"}
    },
    %Country{
      iso2: "SH",
      iso3: "SHN",
      name: "Saint Helena, Ascension and Tristan da Cunha",
      currency: %Currency{code: "SHP", name: "Saint Helena Pound", symbol: "£"}
    },
    %Country{
      iso2: "SI",
      iso3: "SVN",
      name: "Slovenija",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "SJ",
      iso3: "SJM",
      name: "Svalbard og Jan Mayen",
      currency: %Currency{code: "NOK", name: "Norwegian Krone", symbol: "kr"}
    },
    %Country{
      iso2: "SK",
      iso3: "SVK",
      name: "Slovensko",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "SL",
      iso3: "SLE",
      name: "Sierra Leone",
      currency: %Currency{code: "SLL", name: "Sierra Leonean Leone", symbol: "Le"}
    },
    %Country{
      iso2: "SM",
      iso3: "SMR",
      name: "San Marino",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "SN",
      iso3: "SEN",
      name: "Sénégal",
      currency: %Currency{code: "XOF", name: "West African CFA Franc", symbol: "CFA"}
    },
    %Country{
      iso2: "SO",
      iso3: "SOM",
      name: "Soomaaliya",
      currency: %Currency{code: "SOS", name: "Somali Shilling", symbol: "Sh"}
    },
    %Country{
      iso2: "SR",
      iso3: "SUR",
      name: "Suriname",
      currency: %Currency{code: "SRD", name: "Surinamese Dollar", symbol: "$"}
    },
    %Country{
      iso2: "SS",
      iso3: "SSD",
      name: "South Sudan",
      currency: %Currency{code: "SSP", name: "South Sudanese Pound", symbol: "£"}
    },
    %Country{
      iso2: "ST",
      iso3: "STP",
      name: "São Tomé e Príncipe",
      currency: %Currency{code: "STN", name: "São Tomé and Príncipe Dobra", symbol: "Db"}
    },
    %Country{
      iso2: "SV",
      iso3: "SLV",
      name: "El Salvador",
      currency: %Currency{code: "USD", name: "United States Dollar", symbol: "$"}
    },
    %Country{
      iso2: "SX",
      iso3: "SXM",
      name: "Sint Maarten",
      currency: %Currency{code: "ANG", name: "Netherlands Antillean Guilder", symbol: "ƒ"}
    },
    %Country{
      iso2: "SY",
      iso3: "SYR",
      name: "سوريا",
      currency: %Currency{code: "SYP", name: "Syrian Pound", symbol: "ل.س"}
    },
    %Country{
      iso2: "SZ",
      iso3: "SWZ",
      name: "eSwatini",
      currency: %Currency{code: "SZL", name: "Swazi Lilangeni", symbol: "E"}
    },
    %Country{
      iso2: "TC",
      iso3: "TCA",
      name: "Turks and Caicos Islands",
      currency: %Currency{code: "USD", name: "United States Dollar", symbol: "$"}
    },
    %Country{
      iso2: "TD",
      iso3: "TCD",
      name: "Tchad",
      currency: %Currency{code: "XAF", name: "Central African CFA Franc", symbol: "FCFA"}
    },
    %Country{
      iso2: "TF",
      iso3: "ATF",
      name: "Terres australes françaises",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "TG",
      iso3: "TGO",
      name: "Togo",
      currency: %Currency{code: "XOF", name: "West African CFA Franc", symbol: "CFA"}
    },
    %Country{
      iso2: "TH",
      iso3: "THA",
      name: "ประเทศไทย",
      currency: %Currency{code: "THB", name: "Thai Baht", symbol: "฿"}
    },
    %Country{
      iso2: "TJ",
      iso3: "TJK",
      name: "Тоҷикистон",
      currency: %Currency{code: "TJS", name: "Tajikistani Somoni", symbol: "ЅМ"}
    },
    %Country{
      iso2: "TK",
      iso3: "TKL",
      name: "Tokelau",
      currency: %Currency{code: "NZD", name: "New Zealand Dollar", symbol: "$"}
    },
    %Country{
      iso2: "TL",
      iso3: "TLS",
      name: "Timor-Leste",
      currency: %Currency{code: "USD", name: "United States Dollar", symbol: "$"}
    },
    %Country{
      iso2: "TM",
      iso3: "TKM",
      name: "Türkmenистан",
      currency: %Currency{code: "TMT", name: "Turkmenistani Manat", symbol: "T"}
    },
    %Country{
      iso2: "TN",
      iso3: "TUN",
      name: "تونس",
      currency: %Currency{code: "TND", name: "Tunisian Dinar", symbol: "د.ت"}
    },
    %Country{
      iso2: "TO",
      iso3: "TON",
      name: "Tonga",
      currency: %Currency{code: "TOP", name: "Tongan Paʻanga", symbol: "T$"}
    },
    %Country{
      iso2: "TR",
      iso3: "TUR",
      name: "Türkiye",
      currency: %Currency{code: "TRY", name: "Türk Lirası", symbol: "₺"}
    },
    %Country{
      iso2: "TT",
      iso3: "TTO",
      name: "Trinidad and Tobago",
      currency: %Currency{code: "TTD", name: "Trinidad and Tobago Dollar", symbol: "$"}
    },
    %Country{
      iso2: "TV",
      iso3: "TUV",
      name: "Tuvalu",
      currency: %Currency{code: "AUD", name: "Australian Dollar", symbol: "$"}
    },
    %Country{
      iso2: "TW",
      iso3: "TWN",
      name: "臺灣",
      currency: %Currency{code: "TWD", name: "新台币", symbol: "NT$"}
    },
    %Country{
      iso2: "TZ",
      iso3: "TZA",
      name: "Tanzania",
      currency: %Currency{code: "TZS", name: "Tanzanian Shilling", symbol: "TSh"}
    },
    %Country{
      iso2: "UA",
      iso3: "UKR",
      name: "Україна",
      currency: %Currency{code: "UAH", name: "Ukrainian Hryvnia", symbol: "₴"}
    },
    %Country{
      iso2: "UG",
      iso3: "UGA",
      name: "Uganda",
      currency: %Currency{code: "UGX", name: "Ugandan Shilling", symbol: "USh"}
    },
    %Country{
      iso2: "UM",
      iso3: "UMI",
      name: "United States Minor Outlying Islands",
      currency: %Currency{code: "USD", name: "United States Dollar", symbol: "$"}
    },
    %Country{
      iso2: "US",
      iso3: "USA",
      name: "United States",
      currency: %Currency{code: "USD", name: "United States Dollar", symbol: "$"}
    },
    %Country{
      iso2: "UY",
      iso3: "URY",
      name: "Uruguay",
      currency: %Currency{code: "UYU", name: "Peso Uruguayo", symbol: "$"}
    },
    %Country{
      iso2: "UZ",
      iso3: "UZB",
      name: "Oʻzbekiston",
      currency: %Currency{code: "UZS", name: "Uzbekistani Som", symbol: "лв"}
    },
    %Country{
      iso2: "VA",
      iso3: "VAT",
      name: "Vaticano",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "VC",
      iso3: "VCT",
      name: "Saint Vincent and the Grenadines",
      currency: %Currency{code: "XCD", name: "East Caribbean Dollar", symbol: "$"}
    },
    %Country{
      iso2: "VE",
      iso3: "VEN",
      name: "Venezuela",
      currency: %Currency{code: "VES", name: "Venezuelan Bolívar", symbol: "Bs."}
    },
    %Country{
      iso2: "VG",
      iso3: "VGB",
      name: "British Virgin Islands",
      currency: %Currency{code: "USD", name: "United States Dollar", symbol: "$"}
    },
    %Country{
      iso2: "VI",
      iso3: "VIR",
      name: "United States Virgin Islands",
      currency: %Currency{code: "USD", name: "United States Dollar", symbol: "$"}
    },
    %Country{
      iso2: "VN",
      iso3: "VNM",
      name: "Việt Nam",
      currency: %Currency{code: "VND", name: "Vietnamese Đồng", symbol: "₫"}
    },
    %Country{
      iso2: "VU",
      iso3: "VUT",
      name: "Vanuatu",
      currency: %Currency{code: "VUV", name: "Vanuatu Vatu", symbol: "VT"}
    },
    %Country{
      iso2: "WF",
      iso3: "WLF",
      name: "Wallis-et-Futuna",
      currency: %Currency{code: "XPF", name: "CFP Franc", symbol: "₣"}
    },
    %Country{
      iso2: "WS",
      iso3: "WSM",
      name: "Samoa",
      currency: %Currency{code: "WST", name: "Samoan Tala", symbol: "WS$"}
    },
    %Country{
      iso2: "YE",
      iso3: "YEM",
      name: "اليمن",
      currency: %Currency{code: "YER", name: "Yemeni Rial", symbol: "﷼"}
    },
    %Country{
      iso2: "YT",
      iso3: "MYT",
      name: "Mayotte",
      currency: %Currency{code: "EUR", name: "Euro", symbol: "€"}
    },
    %Country{
      iso2: "ZA",
      iso3: "ZAF",
      name: "South Africa",
      currency: %Currency{code: "ZAR", name: "South African Rand", symbol: "R"}
    },
    %Country{
      iso2: "ZM",
      iso3: "ZMB",
      name: "Zambia",
      currency: %Currency{code: "ZMW", name: "Zambian Kwacha", symbol: "ZK"}
    },
    %Country{
      iso2: "ZW",
      iso3: "ZWE",
      name: "Zimbabwe",
      currency: %Currency{code: "ZWL", name: "Zimbabwean Dollar", symbol: "Z$"}
    }
  ]

  # Map countries by ISO2 code for efficient lookup
  @countries_map Map.new(@countries, &{&1.iso2, &1})

  # Map currencies by code for efficient lookup
  @currencies_map Map.new(@countries, fn %{currency: currency} ->
                    {currency.code, currency}
                  end)

  def list_countries, do: @countries

  def get_country(iso2_code) when is_binary(iso2_code) do
    Map.get(@countries_map, String.upcase(iso2_code))
  end

  def get_country(_invalid), do: nil

  @doc """
  Retrieves the symbol for a currency by its code.

  Returns the currency symbol if found, or `nil` if not found.

  ## Examples

      iex> currency_symbol("USD")
      "$"

      iex> currency_symbol("BRL")
      "R$"

      iex> currency_symbol("XXX")
      nil
  """
  def currency_symbol(currency_code) when is_binary(currency_code) do
    case Map.get(@currencies_map, String.upcase(currency_code)) do
      %Currency{symbol: symbol} -> symbol
      nil -> nil
    end
  end

  def currency_symbol(_invalid), do: nil
end
