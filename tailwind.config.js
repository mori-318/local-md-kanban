/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        kanban: {
          todo: "#ef4444",
          inProgress: "#eab308",
          done: "#22c55e",
        },
      },
    },
  },
  plugins: [],
};
