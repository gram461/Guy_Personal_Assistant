// Shared by the Google sign-in, the Calendar and Gmail readers, and the window.

export type CalendarEvent = {
  id: string
  title: string
  // A timestamp with its time zone for timed events, or a plain YYYY-MM-DD date for all-day ones.
  start: string
  // For all-day events this is the day after the last day, as Google reports it.
  end: string
  allDay: boolean
  location: string
}

export type MailMessage = {
  id: string
  threadId: string
  fromName: string
  fromAddress: string
  subject: string
  // The short preview Google gives. The full message is never read.
  snippet: string
  receivedAt: string
  unread: boolean
}

// What is saved (encrypted) on this computer after signing in.
export type GoogleLogin = { refreshToken: string; email: string }

export type GoogleStatus = {
  // The build has a Google client ID, so signing in is possible at all.
  configured: boolean
  connected: boolean
  email: string | null
}

// The person has to sign in with Google again: they never connected, or Google no longer accepts the saved sign-in.
export class GoogleReconnectError extends Error {
  constructor() {
    super('Google needs to be reconnected')
    this.name = 'GoogleReconnectError'
  }
}

// Google answered with an error that isn't about this person's sign-in (it is down, slow, or refused the request).
export class GoogleUnavailableError extends Error {
  constructor(detail: string) {
    super(`Google is unavailable: ${detail}`)
    this.name = 'GoogleUnavailableError'
  }
}

// Google refused the access token itself (HTTP 401), as opposed to refusing the request.
export class GoogleTokenRejectedError extends Error {
  constructor() {
    super('Google rejected the access token')
    this.name = 'GoogleTokenRejectedError'
  }
}

export class GoogleNotConfiguredError extends Error {
  constructor() {
    super("Google isn't set up in this build")
    this.name = 'GoogleNotConfiguredError'
  }
}

// The Google sign-in was cancelled in the browser, or left alone too long.
export class GoogleSignInIncompleteError extends Error {
  constructor(detail = "Google sign-in wasn't finished") {
    super(detail)
    this.name = 'GoogleSignInIncompleteError'
  }
}
