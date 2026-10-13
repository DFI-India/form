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
    error: 'bg-status-returned-bg text-status-returned-fg border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900',
    success: 'bg-status-approved-bg text-status-approved-fg border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900',
    info: 'bg-accent-bg text-accent-fg border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900',
    warning: 'bg-status-pending-bg text-status-pending-fg border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-900',
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
        <div key={i} className="h-4 bg-slate-200 dark:bg-rule rounded animate-pulse" />
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
      <div className={`${sizeClass} border-4 border-slate-200 dark:border-rule border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin`} />
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
            <div key={j} className="flex-1 h-4 bg-slate-200 dark:bg-rule rounded animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  )
}
