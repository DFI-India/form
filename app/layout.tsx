import './globals.css'
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google'
import { ErrorBoundary } from './components/ErrorBoundary'
import { THEME_BOOT_SCRIPT } from '../lib/theme'

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
})

// Identifiers (EAC No, Reg No, Aadhaar, dates) are set in mono so they stay
// scannable in dense tables.
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // suppressHydrationWarning: the boot script may add `dark` to <html> before
    // React hydrates, which would otherwise be reported as a mismatch.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body
        className={`${instrumentSans.variable} ${jetbrainsMono.variable} font-sans min-h-screen bg-slate-100 text-slate-900 dark:bg-surface dark:text-ink`}
      >
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  )
}
