import './globals.css'
import Providers from './providers'

export const metadata = {
  title: 'FC Tools Dashboard',
  description: 'Pull Request dashboard for Field Control'
}

export default function RootLayout ({ children }) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
