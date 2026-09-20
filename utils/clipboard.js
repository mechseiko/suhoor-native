import Clipboard from '@react-native-clipboard/clipboard'
import { Platform } from 'react-native'

export const copyToClipboard = async (text) => {
  if (!text) return false
  
  // Fallback for web preview if running on web
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(String(text))
      return true
    } catch (webErr) {
      console.warn('[Clipboard] Web navigator.clipboard failed:', webErr)
    }
  }

  // Try native clipboard
  try {
    if (Clipboard && Clipboard.setString) {
      Clipboard.setString(String(text))
      return true
    }
  } catch (err) {
    console.warn('[Clipboard] setString failed:', err)
  }

  return false
}

export default { copyToClipboard }
