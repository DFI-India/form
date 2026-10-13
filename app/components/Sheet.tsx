'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

/**
 * A panel that slides in from the edge, used where a screen has a side column
 * that doesn't fit a phone.
 *
 * On a phone a 264px column leaves nothing for the content beside it, so those
 * columns move in here behind a button. The same component covers the filter
 * sheets and the mobile navigation drawer, so all of them behave alike: tap
 * outside or press Escape to close, and the page behind stops scrolling.
 */
export interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  /** 'left' for navigation and lists, 'bottom' for filters and short forms. */
  side?: 'left' | 'right' | 'bottom'
  /** Sticky row at the bottom, usually the confirming button. */
  footer?: React.ReactNode
  children: React.ReactNode
}

export default function Sheet({ open, onClose, title, side = 'left', footer, children }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // Without this the page behind scrolls under the sheet on iOS.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  const position =
    side === 'bottom'
      ? 'inset-x-0 bottom-0 max-h-[85vh] rounded-t-xl border-t'
      : side === 'right'
      ? 'inset-y-0 right-0 w-[86vw] max-w-[360px] border-l'
      : 'inset-y-0 left-0 w-[86vw] max-w-[320px] border-r'

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`absolute flex flex-col overflow-hidden border-rule bg-surface ${position}`}>
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-rule px-4">
          <span className="text-[14px] font-semibold">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-md text-ink-muted hover:bg-surface-hover hover:text-ink"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>

        {footer && <div className="shrink-0 border-t border-rule p-3">{footer}</div>}
      </div>
    </div>
  )
}
