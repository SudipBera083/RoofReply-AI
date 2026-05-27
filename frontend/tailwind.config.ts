import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        roof: {
          slate: '#0f172a',
          dark: '#020617',
          orange: '#f97316', // Construction orange
          red: '#ef4444', // Emergency red
        }
      }
    },
  },
  plugins: [],
}
export default config
