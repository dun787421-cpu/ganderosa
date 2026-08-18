import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { opsHubPlugin } from './opsHubPlugin.js'

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

export default defineConfig({
  // Rutas relativas: funciona en raíz o subcarpeta
  base: './',
  plugins: [opsHubPlugin(), panelMpaPlugin(), react()],
  appType: 'mpa',
  server: {
    watch: {
      ignored: ['**/*.zip', '**/_*.zip.bak', '**/gananet-dist.zip'],
    },
  },
})
