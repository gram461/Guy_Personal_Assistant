import { build } from 'esbuild'

// Builds the script behind the "Get my grades" bookmark into public/, where the website serves it.
// Run automatically before `next build`; the result is committed too, so the site works even if this step is skipped.
const origin = process.env.NEXT_PUBLIC_SCHOOLOGY_ORIGIN || 'https://fuhsd.schoology.com'

await build({
  entryPoints: ['Guy-Scraper/browser/grabber.ts'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'chrome110',
  minify: true,
  legalComments: 'none',
  outfile: 'public/synergy-grabber.js',
  define: { __SCHOOLOGY_ORIGIN__: JSON.stringify(origin) },
  logLevel: 'info',
})
