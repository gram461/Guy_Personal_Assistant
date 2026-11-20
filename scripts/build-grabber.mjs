import { build } from 'esbuild'

// Builds the script behind the "Get my grades" bookmark into public/, where the website serves it.
// Run automatically before `next build`; the result is committed too, so the site works even if this step is skipped.
const origin = process.env.NEXT_PUBLIC_SCHOOLOGY_ORIGIN || 'https://fuhsd.schoology.com'

// The bookmark's helper, and the phone app's headless one. Older phones' web views need an older target.
for (const [entry, outfile, target] of [
  ['Guy-Scraper/browser/grabber.ts', 'public/synergy-grabber.js', 'chrome110'],
  ['Guy-Scraper/browser/nativeGrabber.ts', 'public/synergy-native-grabber.js', 'es2020'],
]) {
  await build({
    entryPoints: [entry],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target,
    minify: true,
    legalComments: 'none',
    outfile,
    define: { __SCHOOLOGY_ORIGIN__: JSON.stringify(origin) },
    logLevel: 'info',
  })
}
