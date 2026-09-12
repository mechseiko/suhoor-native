/**
 * Utility to detect the user's country on sign-up using fast, lightweight geolocation APIs
 * with an automatic fallback to timezone.
 */
export async function detectUserCountry() {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2500)
    const res = await fetch('https://ipwho.is/', { signal: controller.signal })
    clearTimeout(timer)
    if (res.ok) {
      const data = await res.json()
      if (data?.success !== false && data?.country) {
        return data.country
      }
    }
  } catch (e) {
    // fallback
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2000)
    const res = await fetch('https://api.country.is', { signal: controller.signal })
    clearTimeout(timer)
    if (res.ok) {
      const data = await res.json()
      if (data?.country) {
        if (typeof Intl !== 'undefined' && Intl.DisplayNames) {
          const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
          return regionNames.of(data.country) || data.country
        }
        return data.country
      }
    }
  } catch (e) {
    // fallback
  }

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz) {
      const parts = tz.split('/')
      return parts[parts.length - 1].replace(/_/g, ' ')
    }
  } catch (e) {
    // fallback
  }

  return 'Unknown'
}
