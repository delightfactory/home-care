import React, { useEffect, useRef, ReactNode } from 'react'
import { X } from 'lucide-react'

interface SmartModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  icon?: ReactNode
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  headerGradient?: string
  closeOnOutsideClick?: boolean
  closeOnEscape?: boolean
  showCloseButton?: boolean
  className?: string
  headerClassName?: string
  contentClassName?: string
}

const SmartModal: React.FC<SmartModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  size = 'md',
  headerGradient = 'from-primary-500 via-primary-600 to-primary-700',
  closeOnOutsideClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  className = '',
  headerClassName = '',
  contentClassName = ''
}) => {
  const modalRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Handle outside clicks
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        closeOnOutsideClick &&
        modalRef.current &&
        contentRef.current &&
        !contentRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, closeOnOutsideClick, onClose])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, closeOnEscape, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalStyle
      }
    }
  }, [isOpen])

  // Focus management - only on initial open, not on content changes
  useEffect(() => {
    if (isOpen && contentRef.current) {
      // Focus the modal container itself instead of child elements
      // This prevents scroll jumping when conditional content renders
      contentRef.current.focus()
    }
  }, [isOpen])

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'max-w-sm'
      case 'md':
        return 'max-w-lg'
      case 'lg':
        return 'max-w-2xl'
      case 'xl':
        return 'max-w-4xl'
      case '2xl':
        return 'max-w-6xl'
      default:
        return 'max-w-lg'
    }
  }

  if (!isOpen) return null

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        ref={contentRef}
        className={`bg-white rounded-2xl shadow-2xl w-full ${getSizeClasses()} max-h-[90vh] overflow-hidden transform animate-slide-in border border-gray-100 ${className}`}
      >
        {/* Header */}
        {(title || subtitle || icon || showCloseButton) && (
          <div className="relative overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${headerGradient}`}></div>
            <div className={`relative flex items-center justify-between p-6 text-white ${headerClassName}`}>
              <div className="flex items-center">
                {icon && (
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl ml-3 shadow-lg border border-white/30">
                    {icon}
                  </div>
                )}
                <div>
                  {title && (
                    <h2 id="modal-title" className="text-xl font-bold text-white">
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <p className="text-white/80 text-sm mt-1">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-lg transition-all duration-200 hover:scale-110 border border-white/30"
                  aria-label="إغلاق"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div
          className={`overflow-y-auto overscroll-contain max-h-[calc(90vh-120px)] ${contentClassName}`}
          style={{ scrollBehavior: 'auto' }}
          tabIndex={-1}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

export default SmartModal