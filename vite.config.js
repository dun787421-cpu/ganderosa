import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import obfuscator from 'rollup-plugin-obfuscator'
import { opsHubPlugin } from './opsHubPlugin.js'
import { obfuscatorOptions } from './obfuscator.options.js'

function panelMpaPlugin() {
  return {
    name: 'panel-mpa',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url?.split('?')[0]
        if (url === '/panel' || url === '/panel/') {
          req.url = '/panel/index.html'
        }
        next()
      })
    },
  }
}

export default defineConfig(({ command }) => ({
  // Rutas relativas: funciona en raíz o subcarpeta de Namecheap
  base: './',
  plugins: [
    opsHubPlugin(),
    panelMpaPlugin(),
    react(),
    ...(command === 'build'
      ? [
          obfuscator({
            global: true,
            options: obfuscatorOptions,
          }),
        ]
      : []),
  ],
  appType: 'mpa',
  server: {
    watch: {
      ignored: ['**/*.zip', '**/_*.zip.bak', '**/gananet-dist.zip'],
    },
  },
}))
