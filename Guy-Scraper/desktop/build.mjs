import { build } from 'esbuild'
import { cp, rm } from 'node:fs/promises'

await rm('dist', { recursive: true, force: true })

// Everything except Electron itself is bundled in, so the installed app needs no node_modules.
await build({
  entryPoints: ['main.ts', 'preload.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  outdir: 'dist',
  external: ['electron'],
  legalComments: 'none',
  logLevel: 'info',
})

// The window, bundled for the browser. It uses system fonts and loads nothing from the internet.
await build({
  entryPoints: { renderer: 'ui/main.tsx' },
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'chrome140',
  outdir: 'dist',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: true,
  legalComments: 'none',
  logLevel: 'info',
})

await cp('ui/styles.css', 'dist/styles.css')
await cp('index.html', 'dist/index.html')
