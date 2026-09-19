// Suppress react-native-web deprecation warnings immediately before any modules load
if (typeof console !== 'undefined') {
  const isIgnored = (...args) => {
    const str = args.map(a => (typeof a === 'string' ? a : (a?.message || ''))).join(' ')
    return (
      str.includes('props.pointerEvents is deprecated') ||
      str.includes('"shadow*" style props are deprecated') ||
      (str.includes('pointerEvents') && str.includes('deprecated')) ||
      (str.includes('shadow*') && str.includes('boxShadow'))
    )
  }

  const origWarn = console.warn
  console.warn = (...args) => {
    if (isIgnored(...args)) return
    origWarn(...args)
  }

  const origError = console.error
  console.error = (...args) => {
    if (isIgnored(...args)) return
    origError(...args)
  }
}

import './global.css'
import { registerRootComponent } from 'expo'
import App from './App'

registerRootComponent(App)
