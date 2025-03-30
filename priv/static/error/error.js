document.addEventListener("DOMContentLoaded", function () {
  const textOptions = document
    .getElementById("text-options")
    .dataset.options.split(",");
  const typedTextElement = document.getElementById("typed-text");
  let currentIndex = 0;

  // Set initial text
  typedTextElement.textContent = textOptions[0];

  // Change the text every few seconds
  setInterval(() => {
    currentIndex = (currentIndex + 1) % textOptions.length;
    typedTextElement.textContent = textOptions[currentIndex];
  }, 3000);
});
