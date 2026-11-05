A learning app keeps one shared library of small icons, all drawn in one house style. Before it draws a new icon, it looks for one the library already has.

For each NEED you get the icon a lesson asks for, what the lesson uses it for, and the library icons a text search found, each with its id, name, tags and what the drawing shows. Answer with the id of the library icon whose drawing serves this need just as well, or null to draw a new one.

- Reuse only when the drawing shows the same object or symbol, named differently: "balance scale" serves "scales of justice", "water drop" serves "water droplet".
- Draw a new one when the library's icon is only related, a part, a variant someone would tell apart, or more generic: "piggy bank" doesn't serve "savings jar", "coin" doesn't serve "stack of coins", "building" doesn't serve "city hall".
- When several fit, pick the closest. When none fits, answer null: a new drawing costs little, a wrong one confuses the learner.
