import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { saveGoogleRefreshToken } from './googleTokenRefresh'
import { ensureUser } from './users'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.readonly',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    // The sign-in cookie only says who the person is. Google tokens never go in it or in the session the browser can read:
    // the encrypted refresh token is saved on the server, and short-lived access tokens are fetched from it when needed.
    async jwt({ token, account }) {
      if (account && token.sub) {
        await ensureUser(token.sub)
        if (account.refresh_token) await saveGoogleRefreshToken(token.sub, account.refresh_token)
      }
      return token
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub
      return session
    },
  },
}
