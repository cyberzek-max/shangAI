import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// Custom plugin to suppress missing sourcemap warnings from @mediapipe/tasks-vision
const silenceMediapipeSourcemap: Plugin = {
  name: 'silence-mediapipe-sourcemap',
  transform(code, id) {
    if (id.includes('@mediapipe/tasks-vision')) {
      return {
        code: code.replace(/\/\/# sourceMappingURL=.*/g, ''),
        map: null,
      }
    }
  },
}

export default defineConfig({
  plugins: [react(), basicSsl(), silenceMediapipeSourcemap],
  server: {
    host: '0.0.0.0',
    port: 5173,
    cors: true,
  },
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision'],
  },
})


