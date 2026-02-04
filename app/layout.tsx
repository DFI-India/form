import './globals.css'
import { Poppins } from 'next/font/google'
import { ErrorBoundary } from './components/ErrorBoundary'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${poppins.className} min-h-screen bg-slate-100 text-slate-900`}>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  )
}