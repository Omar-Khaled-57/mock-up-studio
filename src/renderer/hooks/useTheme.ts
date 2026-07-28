import { useStore } from '../store'

/**
 * Returns Tailwind class strings for light theme backgrounds, borders, and text.
 * In dark mode, returns empty strings (the base classes apply).
 * In light mode, returns override classes that take precedence.
 *
 * Usage: <div className={clsx("bg-zinc-950", theme.bg.primary)}>
 */
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
    bg: {
      primary: isLight ? '!bg-white' : '',
      secondary: isLight ? '!bg-zinc-50' : '',
      tertiary: isLight ? '!bg-zinc-100' : '',
      panel: isLight ? '!bg-white/80' : '',
      input: isLight ? '!bg-zinc-100 !text-zinc-900 !border-zinc-300' : '',
      button: isLight ? '!bg-zinc-100 !text-zinc-700 !border-zinc-300 hover:!bg-zinc-200' : '',
      buttonActive: isLight ? '!bg-indigo-100 !text-indigo-700 !border-indigo-300' : '',
      surface: isLight ? '!bg-zinc-50 !border-zinc-200' : ''
    },
    text: {
      primary: isLight ? '!text-zinc-900' : '',
      secondary: isLight ? '!text-zinc-600' : '',
      tertiary: isLight ? '!text-zinc-500' : '',
      muted: isLight ? '!text-zinc-400' : ''
    },
    border: {
      primary: isLight ? '!border-zinc-200' : '',
      secondary: isLight ? '!border-zinc-300' : ''
    }
  }
}
