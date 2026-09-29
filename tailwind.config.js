/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./*.html"],

  theme: {
    extend: {
      fontFamily: { spacemono: ["Space Mono", "monospace"] },
      fontWeight: { 300: "300", 400: "400", 500: "500", 700: "700" },
      colors: {
        background: "rgba(var(--background))",
        cardBackground: "rgba(var(--cardbackground))",
        softwhite: "rgba(var(--softwhite))",
      },
    },

    plugins: [
      function ({ addUtilities }) {
        addUtilities({
          ".no-arrows": {
            "&::-webkit-inner-spin-button": {
              "-webkit-appearance": "none",
              margin: "0",
            },
            "&::-webkit-outer-spin-button": {
              "-webkit-appearance": "none",
              margin: "0",
            },
            '&[type="number"]': {
              "-moz-appearance": "textfield",
            },
          },
        });
      },
    ],
    darkMode: "class",
  },
};
