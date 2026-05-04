import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'green' | 'yellow' | 'red' | 'zinc'
  className?: string
}

export function Badge({ children, variant = 'zinc', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        variant === 'green' && 'bg-green-900/40 text-green-400',
        variant === 'yellow' && 'bg-yellow-900/40 text-yellow-400',
        variant === 'red' && 'bg-red-900/40 text-red-400',
        variant === 'zinc' && 'bg-zinc-700 text-zinc-300',
        className,
      )}
    >
      {children}
    </span>
  )
}
