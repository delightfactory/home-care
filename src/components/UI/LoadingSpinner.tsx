import React from 'react'
import { clsx } from 'clsx'

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large'
  className?: string
  text?: string
  variant?: 'spinner' | 'dots' | 'pulse'
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  className,
  text,
  variant = 'spinner'
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  }

  const textSizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base'
  }

  const renderSpinner = () => {
    switch (variant) {
      case 'dots':
        return (
          <div className="flex space-x-1 space-x-reverse">
            <div className={clsx('bg-primary-600 rounded-full animate-bounce', 
              size === 'small' ? 'w-2 h-2' : size === 'medium' ? 'w-3 h-3' : 'w-4 h-4'
            )} style={{ animationDelay: '0ms' }} />
            <div className={clsx('bg-primary-600 rounded-full animate-bounce', 
              size === 'small' ? 'w-2 h-2' : size === 'medium' ? 'w-3 h-3' : 'w-4 h-4'
            )} style={{ animationDelay: '150ms' }} />
            <div className={clsx('bg-primary-600 rounded-full animate-bounce', 
              size === 'small' ? 'w-2 h-2' : size === 'medium' ? 'w-3 h-3' : 'w-4 h-4'
            )} style={{ animationDelay: '300ms' }} />
          </div>
        )
      case 'pulse':
        return (
          <div className={clsx(
            'bg-primary-600 rounded-full animate-pulse',
            sizeClasses[size]
          )} />
        )
      default:
        return (
          <div
            className={clsx(
              'border-4 border-gray-200 border-t-primary-600 rounded-full animate-spin',
              sizeClasses[size]
            )}
          />
        )
    }
  }

  return (
    <div className={clsx('flex flex-col items-center justify-center gap-3', className)}>
      {renderSpinner()}
      {text && (
        <p className={clsx('text-gray-600 text-center font-medium', textSizeClasses[size])}>
          {text}
        </p>
      )}
    </div>
  )
}

export default LoadingSpinner
