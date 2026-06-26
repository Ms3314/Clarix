import { cn } from '@/lib/utils'

const sizes = {
  xs: 'h-3 w-3 border',
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-2',
  xl: 'h-16 w-16 border-3',
}

const Loading = ({ size = 'md', text, className }) => {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div
        className={cn(
          'animate-spin rounded-full border-zinc-300 border-t-transparent',
          sizes[size] || sizes.md,
        )}
      />
      {text && <p className="text-xs text-zinc-400">{text}</p>}
    </div>
  )
}

export { Loading }
