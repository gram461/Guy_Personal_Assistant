import { GoogleTokenRejectedError } from '@/Guy-Scraper/google/types'
import { GoogleReconnectError, forgetGoogleAccessToken, getGoogleAccessToken } from './googleTokenRefresh'

// Runs one of the Google readers shared with the desktop app (Guy-Scraper/google/api.ts) for this person, using the encrypted
// sign-in saved on the server. If Google rejects the access token it was given, it tries once more with a fresh one;
// rejected again means the person needs to sign in again.
export async function withWebGoogle<T>(userId: string, run: (accessToken: string) => Promise<T>): Promise<T> {
  try {
    return await run(await getGoogleAccessToken(userId))
  } catch (err) {
    if (!(err instanceof GoogleTokenRejectedError)) throw err
  }

  forgetGoogleAccessToken(userId)
  try {
    return await run(await getGoogleAccessToken(userId))
  } catch (err) {
    if (err instanceof GoogleTokenRejectedError) throw new GoogleReconnectError()
    throw err
  }
}
