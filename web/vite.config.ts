import { readFileSync } from 'node:fs'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The version number has a single source: package.json
const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as { version: string }

export default defineConfig({
  // Relative paths: the build works from any folder:
  // GitHub Pages (/<repo>/), a local file, the Windows app.
  base: './',
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    rolldownOptions: {
      output: {
        // React is a separate file: it changes rarely, so after a site update
        // the browser takes it from the cache. The weapon tables are in their own files anyway
        // (they load one by one, see data/artillery/tables.ts)
        codeSplitting: {
          groups: [{ name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ }],
        },
      },
    },
  },
})
