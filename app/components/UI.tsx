'use client'

import { X } from 'lucide-react'

interface AlertProps {
  type: 'error' | 'success' | 'info' | 'warning'
  message: string
  onDismiss?: () => void
  className?: string
}

export function Alert({ type, message, onDismiss, className = '' }: AlertProps) {
  const styles = {
    error: 'bg-red-50 text-red-700 border-red-200',
    success: 'bg-green-50 text-green-700 border-green-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    warning: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  }

  return (
    <div className={`rounded-lg p-4 text-sm border ${styles[type]} flex items-start justify-between ${className}`}>
      <span>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="ml-4 hover:opacity-70">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

interface SkeletonProps {
  rows?: number
  className?: string
}

export function Skeleton({ rows = 1, className = '' }: SkeletonProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 bg-slate-200 rounded animate-pulse" />
      ))}
    </div>
  )
}

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
}

export function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
  const sizeClass = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  }[size]

  return (
    <div className="flex justify-center items-center p-4">
      <div className={`${sizeClass} border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin`} />
    </div>
  )
}

interface TableSkeletonProps {
  rows?: number
  columns?: number
}

export function TableSkeleton({ rows = 5, columns = 5 }: TableSkeletonProps) {
  return (
    <div className="space-y-4 p-6">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className="flex-1 h-4 bg-slate-200 rounded animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  )
}
