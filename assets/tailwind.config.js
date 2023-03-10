// See the Tailwind configuration guide for advanced usage
// https://tailwindcss.com/docs/configuration

const plugin = require("tailwindcss/plugin")
const colors = require("tailwindcss/colors")
const fs = require("fs")
const path = require("path")

module.exports = {
  content: [
    "./js/**/*.js",
    "../lib/*_web.ex",
    "../lib/*_web/**/*.*ex"
  ],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      primary: {
        light3x: colors.fuchsia[50],
        light2x: colors.fuchsia[100],
        light: colors.fuchsia[300],
        DEFAULT: colors.fuchsia[500],
        dark: colors.fuchsia[700],
      },
      alert: {
        light3x: colors.pink[50],
        light2x: colors.pink[100],
        light: colors.pink[300],
        DEFAULT: colors.pink[500],
        dark: colors.pink[700]
      },
      info: {
        light3x: colors.cyan[50],
        light2x: colors.cyan[100],
        light: colors.cyan[300],
        DEFAULT: colors.cyan[500],
        dark: colors.cyan[700]
      },
      success: {
        light3x: colors.teal[50],
        light2x: colors.teal[100],
        light: colors.teal[300],
        DEFAULT: colors.teal[500],
        dark: colors.teal[700]
      },
      warning: {
        light3x: colors.amber[50],
        light2x: colors.amber[100],
        light: colors.amber[300],
        DEFAULT: colors.amber[500],
        dark: colors.amber[700]
      },
      gray: {
        light3x: colors.slate[50],
        light2x: colors.slate[100],
        light: colors.slate[300],
        DEFAULT: colors.slate[500],
        dark: colors.slate[700],
      },
      white: {
        DEFAULT: colors.white,
        dark: colors.slate[100],
      },
    },
    extends: {}
  },
  plugins: [
    require("@tailwindcss/forms"),
    // Allows prefixing tailwind classes with LiveView classes to add rules
    // only when LiveView classes are applied, for example:
    //
    //     <div class="phx-click-loading:animate-ping">
    //
    plugin(({addVariant}) => addVariant("phx-no-feedback", [".phx-no-feedback&", ".phx-no-feedback &"])),
    plugin(({addVariant}) => addVariant("phx-click-loading", [".phx-click-loading&", ".phx-click-loading &"])),
    plugin(({addVariant}) => addVariant("phx-submit-loading", [".phx-submit-loading&", ".phx-submit-loading &"])),
    plugin(({addVariant}) => addVariant("phx-change-loading", [".phx-change-loading&", ".phx-change-loading &"])),

    // Embeds Hero Icons (https://heroicons.com) into your app.css bundle
    // See your `CoreComponents.icon/1` for more information.
    //
    plugin(function({matchComponents, theme}) {
      let iconsDir = path.join(__dirname, "./vendor/hero_icons/optimized")
      let values = {}
      let icons = [
        ["", "/24/outline"],
        ["-solid", "/24/solid"],
        ["-mini", "/20/solid"]
      ]
      icons.forEach(([suffix, dir]) => {
        fs.readdirSync(path.join(iconsDir, dir)).map(file => {
          let name = path.basename(file, ".svg") + suffix
          values[name] = {name, fullPath: path.join(iconsDir, dir, file)}
        })
      })
      matchComponents({
        "hero": ({name, fullPath}) => {
          let content = fs.readFileSync(fullPath).toString().replace(/\r?\n|\r/g, "")
          return {
            [`--hero-${name}`]: `url('data:image/svg+xml;utf8,${content}')`,
            "-webkit-mask": `var(--hero-${name})`,
            "mask": `var(--hero-${name})`,
            "background-color": "currentColor",
            "vertical-align": "middle",
            "display": "inline-block",
            "width": theme("spacing.5"),
            "height": theme("spacing.5")
          }
        }
      }, {values})
    })
  ]
}
