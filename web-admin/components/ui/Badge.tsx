import { cn } from '@/lib/utils'

interface BadgeProps {
  variant?: 'success' | 'danger' | 'warning' | 'default'
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        variant === 'success' && 'bg-green-900/50 text-green-400 border border-green-800',
        variant === 'danger' && 'bg-red-900/50 text-red-400 border border-red-800',
        variant === 'warning' && 'bg-yellow-900/50 text-yellow-400 border border-yellow-800',
        variant === 'default' && 'bg-zinc-800 text-zinc-400 border border-zinc-700',
        className,
      )}
    >
      {children}
    </span>
  )
}
