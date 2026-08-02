import { useStore } from '../store'

function clsx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function useTheme() {
  const theme = useStore((s) => s.theme)
  const isLight = theme === 'light'

  return {
    theme,
    isLight,
    toggleTheme: useStore((s) => s.toggleTheme),
    clsx,
    accent: {
      DEFAULT: isLight ? 'bg-indigo-600 text-white' : 'bg-indigo-500 text-white',
      soft: isLight ? 'bg-indigo-600/12 text-indigo-700' : 'bg-indigo-500/15 text-indigo-300',
      fill: isLight ? 'bg-indigo-600' : 'bg-indigo-500',
      text: isLight ? 'text-indigo-700' : 'text-indigo-300',
      hover: isLight ? 'hover:bg-indigo-700' : 'hover:bg-indigo-400',
      ring: isLight ? 'focus-visible:ring-indigo-600' : 'focus-visible:ring-indigo-500',
      border: isLight ? 'border-indigo-600' : 'border-indigo-500'
    },
    radius: {
      sm: 'rounded-[6px]',
      md: 'rounded-lg',
      lg: 'rounded-xl',
      pill: 'rounded-full'
    },
    bg: {
      primary: isLight ? 'bg-white' : 'bg-zinc-950',
      secondary: isLight ? 'bg-zinc-50' : 'bg-zinc-900',
      tertiary: isLight ? 'bg-zinc-100' : 'bg-zinc-800',
      panel: isLight ? 'bg-white' : 'bg-zinc-900/50',
      input: isLight ? 'bg-white text-zinc-900 border-zinc-300 focus:border-indigo-600' : 'bg-zinc-800 text-zinc-200 border-zinc-700 focus:border-indigo-500/50',
      button: isLight ? 'bg-zinc-100 text-zinc-700 border-zinc-300 hover:bg-zinc-200 hover:text-zinc-900' : 'bg-zinc-800/60 text-zinc-300 border-zinc-700/50 hover:bg-zinc-700/80 hover:text-zinc-100',
      buttonActive: isLight ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      surface: isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-800/60 border-zinc-800/60',
      hover: isLight ? 'hover:bg-zinc-100' : 'hover:bg-zinc-800/60',
      active: isLight ? 'bg-indigo-50 border-indigo-200' : 'bg-indigo-500/10 border-indigo-500/20',
      selected: isLight ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30',
      danger: isLight ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20',
      canvas: isLight ? 'bg-zinc-100' : 'bg-zinc-950',
      ruler: isLight ? 'bg-zinc-200 border-zinc-300' : 'bg-zinc-900 border-zinc-800',
      tabRail: isLight ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-zinc-800/60'
    },
    text: {
      primary: isLight ? 'text-zinc-900' : 'text-zinc-100',
      secondary: isLight ? 'text-zinc-700' : 'text-zinc-300',
      tertiary: isLight ? 'text-zinc-600' : 'text-zinc-400',
      muted: isLight ? 'text-zinc-600' : 'text-zinc-400',
      inverse: isLight ? 'text-white' : 'text-zinc-900'
    },
    border: {
      primary: isLight ? 'border-zinc-200' : 'border-zinc-800',
      secondary: isLight ? 'border-zinc-300' : 'border-zinc-700',
      tertiary: isLight ? 'border-zinc-100' : 'border-zinc-800/60',
      focus: isLight ? 'focus:border-indigo-600' : 'focus:border-indigo-500/50'
    },
    shadow: {
      sm: isLight ? 'shadow-sm' : 'shadow-[0_1px_2px_rgba(0,0,0,0.4)]',
      md: isLight ? 'shadow-md' : 'shadow-[0_4px_16px_rgba(0,0,0,0.35)]',
      lg: isLight ? 'shadow-lg' : 'shadow-[0_8px_32px_rgba(0,0,0,0.35)]',
      inner: isLight ? 'shadow-inner' : ''
    }
  }
}
