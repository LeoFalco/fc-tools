import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          hd: 'fieldcontrol.com.br'
        }
      }
    })
  ],
  callbacks: {
    signIn ({ profile }) {
      return profile?.email?.endsWith('@fieldcontrol.com.br') ?? false
    }
  },
  trustHost: true
})
