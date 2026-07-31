import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { saveGoogleRefreshToken, getFreshGoogleAccessToken } from './googleTokenRefresh'

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
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
        token.expiresAt = account.expires_at
        if (account.refresh_token) {
          await saveGoogleRefreshToken(account.refresh_token)
        }
        return token
      }

      const expiresAt = (token.expiresAt as number | undefined) ?? 0
      if (Date.now() < expiresAt * 1000 - 5 * 60 * 1000) {
        return token
      }

      const freshAccessToken = await getFreshGoogleAccessToken()
      if (freshAccessToken) {
        token.accessToken = freshAccessToken
        token.expiresAt = Math.floor(Date.now() / 1000) + 3600
      }
      return token
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken
      return session
    },
  },
}
