import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        lab: {
          bg: "#05070B",
          panel: "#0B1018",
          panel2: "#111923",
          panel3: "#151F2B",
          line: "#243041",
          text: "#EDF4FF",
          muted: "#8C9AAF",
          subdued: "#617086",
          cyan: "#48C7F4",
          amber: "#E8B84E",
          red: "#F06A63",
          green: "#65D990",
        },
      },
      boxShadow: {
        "panel-glow": "0 24px 90px rgba(0, 0, 0, 0.46)",
        "primary-glow": "0 28px 110px rgba(12, 199, 244, 0.08), 0 24px 80px rgba(0, 0, 0, 0.52)",
      },
    },
  },
  plugins: [],
};

export default config;
