import { GoogleReconnectError, forgetGoogleAccessToken, getGoogleAccessToken } from './googleTokenRefresh'

// Google refused the access token itself (HTTP 401), as opposed to refusing the request.
export class GoogleTokenRejectedError extends Error {
  constructor() {
    super('Google rejected the access token')
    this.name = 'GoogleTokenRejectedError'
  }
}

// Runs a Google call for this person. If Google rejects the token we used (revoked a moment ago, or the clock is off),
// it is dropped and the call is tried once more with a fresh one. Still rejected means they need to sign in again.
export async function withGoogleAccess<T>(userId: string, run: (accessToken: string) => Promise<T>): Promise<T> {
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
