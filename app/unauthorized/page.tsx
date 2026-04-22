'use client'

import { useRouter } from 'next/navigation'
import { useSignOut } from '../../lib/hooks'
import { Lock } from 'lucide-react'

export default function UnauthorizedPage() {
  const router = useRouter()
  const { signOut } = useSignOut()

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-8 text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center text-3xl">
          <Lock className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Access Denied</h1>
        <p className="text-slate-600">
          You don't have permission to access this resource. Please contact your administrator if you believe this is an error.
        </p>
        <div className="flex gap-3 pt-4">
          <button
            onClick={() => router.replace('/dashboard')}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => signOut()}
            className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
          >
            Sign Out
          </button>
        </div>
      </div>
    </main>
  )
}
