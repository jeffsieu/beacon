import { useLocalStorage } from 'usehooks-ts'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'beacon-theme'

export function useTheme() {
  const [theme, setTheme] = useLocalStorage<Theme>(STORAGE_KEY, 
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    { initializeWithValue: true }
  )

  // Setting a DOM attribute during render is safe — React itself does this for hydration.
  // It doesn't depend on DOM state and is idempotent.
  document.documentElement.setAttribute('data-theme', theme)

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return { theme, toggle }
}
