const fs = require("fs");
const path = require("path");
const plugin = require("tailwindcss/plugin");

// Embeds Tabler Icons (https://tabler-icons.io/) into your app.css bundle
// Credits: [Florian Arens](https://farens.me/blog/how-to-integrate-tabler-icons-into-your-phoenix-project)
module.exports = plugin(function ({ matchComponents, theme }) {
  const iconsDir = path.join(__dirname, "../../deps/tabler_icons/icons");
  const values = {};

  const icons = [
    ["", "/outline"],
    ["-filled", "/filled"],
  ];

  icons.forEach(([suffix, dir]) => {
    fs.readdirSync(path.join(iconsDir, dir)).forEach((file) => {
      const name = path.basename(file, ".svg") + suffix;
      values[name] = { name, fullPath: path.join(iconsDir, dir, file) };
    });
  });

  matchComponents(
    {
      tabler: ({ name, fullPath }) => {
        const content = fs
          .readFileSync(fullPath)
          .toString()
          .replace(/\r?\n|\r/g, "")
          .replace('stroke-width="2"', 'stroke-width="1"')
          .replace(/width="[^"]*"/, "")
          .replace(/height="[^"]*"/, "");

        return {
          [`--tabler-${name}`]: `url('data:image/svg+xml;utf8,${content}')`,
          "-webkit-mask": `var(--tabler-${name})`,
          mask: `var(--tabler-${name})`,
          "mask-repeat": "no-repeat",
          "background-color": "currentColor",
          "vertical-align": "middle",
          display: "inline-block",
          width: theme("spacing.5"),
          height: theme("spacing.5"),
        };
      },
    },
    { values },
  );
});
