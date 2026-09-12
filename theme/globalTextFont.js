import { Text, TextInput } from 'react-native'
import { font } from './typography'

/**
 * Give every `Text` / `TextInput` the body family by default.
 *
 * The web app sets this once in CSS (`body { font-family: var(--font-body) }`),
 * so a bare `<p>` is already Quicksand. React Native has no cascade and no
 * document root: a `<Text>` inherits only from an ancestor `<Text>`, so a screen
 * that imports `Text` straight from `react-native` renders in the platform UI
 * face no matter what the theme says. Seven files still do that, which is why
 * the two families looked like they applied on some screens and not others.
 *
 * Rather than convert ~78 call sites, we seed the default on the base components
 * themselves. Ours goes in *first*, so any style the call site passes — and the
 * roles in `components/ui/Text` — still win.
 *
 * `Text` and `TextInput` are `forwardRef` objects, so their `render` is the
 * function React invokes. Patching it is a reach into React Native's internals,
 * hence the guard: if a future version stops exposing `render`, the app keeps
 * working with the platform face instead of crashing.
 */
const applyDefaultFamily = (Component, label) => {
  if (Component?.__suhoorFontDefault) return
  if (typeof Component?.render !== 'function') {
    if (__DEV__) {
      console.warn(
        `[theme] Could not set the default font family on ${label}: React Native no longer exposes a render function on it. Text outside components/ui/Text will use the platform face.`
      )
    }
    return
  }

  const base = font('body')
  const original = Component.render

  Component.render = function patchedRender(props, ref) {
    return original.call(this, { ...props, style: [base, props.style] }, ref)
  }
  Component.__suhoorFontDefault = true
}

applyDefaultFamily(Text, 'Text')
applyDefaultFamily(TextInput, 'TextInput')
