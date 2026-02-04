'use client'

import { useEffect } from 'react'
import { redirect } from 'next/navigation'

export default function Home() {
  useEffect(() => {
    // Redirect to dashboard which will route based on auth status
    redirect('/dashboard')
  }, [])

  return null
}
