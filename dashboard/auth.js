import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'

const users = [
  { email: 'leonardo@fieldcontrol.com.br', password: 'leonardo@fieldcontrol.com.br leonardo@fieldcontrol.com.br' }
]

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' }
      },
      async authorize (credentials) {
        const user = users.find(
          (u) => u.email === credentials?.email && u.password === credentials?.password
        )
        if (!user) return null
        return { id: user.email, email: user.email, name: user.email.split('@')[0] }
      }
    })
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login'
  },
  trustHost: true
})
