import './globals.css'
import { Poppins } from 'next/font/google'

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
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-10">
          {children}
        </div>
      </body>
    </html>
  )
}