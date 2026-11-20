import type { Failure, Synergy } from '@/Guy-Scraper/desktop/ui/bridge'
import { signInAndRead, type SignInDeps } from './nativeSignIn'

// What the phone app uses in place of the website's bridge. Everything the website does stays (grades and edits are kept on the
// phone, Delete my data works); the Schoology sign-in is the in-app window instead of a bookmark or a file.
export function createAppBridge(base: Synergy, deps: SignInDeps): Synergy {
  const fail = (message: string): Promise<Failure> => Promise.resolve({ ok: false, message })

  async function readFromSchoology(fresh: boolean) {
    const result = await signInAndRead(deps, { fresh })
    if (!result.ok) return fail(result.message)
    // The same checks as any imported file, so a bad answer can't replace good grades.
    return (await base.importGrades?.(result.tsv)) ?? fail("The grades couldn't be saved on this phone.")
  }

  return {
    ...base,
    platform: 'app',
    grabberLink: undefined,

    // The refresh arrow. If the person is still signed in the window opens and closes by itself.
    sync: () => readFromSchoology(false),
    // Sign in again, or switch to a different account.
    signIn: () => readFromSchoology(true),

    signOut: async () => {
      await deps.plugin.clearCookies({ url: deps.schoologyOrigin }).catch(() => undefined)
      return base.signOut()
    },
    deleteData: async () => {
      const result = await base.deleteData()
      if (result.ok) await deps.plugin.clearCookies({ url: deps.schoologyOrigin }).catch(() => undefined)
      return result
    },

    // Not in the phone app yet. Google refuses to sign people in inside an app's own window, so calendar and email stay on the website.
    googleStatus: () => Promise.resolve({ ok: true, configured: false, connected: false, email: null }),
    exportTsv: () => fail('Exporting a file is not available in the phone app.'),
    openFolder: () => fail('There is no data folder on a phone. Your data is kept in this app.'),
  }
}
