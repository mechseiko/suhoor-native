/**
 * Utility to detect the user's country on sign-up using fast, lightweight geolocation APIs
 * with timezone fallback that returns country instead of city/state.
 * Returns country name like "Nigeria", "United Kingdom", "USA".
 */

export async function detectUserLocationDetails() {
  // 1. Primary: ipwho.is
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch('https://ipwho.is/', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data?.success !== false && data?.country) {
        const country = data.country || '';
        return {
          country,
          state: '',
          city: '',
          locationString: country,
        };
      }
    }
  } catch (e) {
    // fallback
  }

  // 2. Secondary: ipapi.co
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data?.country_name) {
        const country = data.country_name || '';
        return {
          country,
          state: '',
          city: '',
          locationString: country,
        };
      }
    }
  } catch (e) {
    // fallback
  }

  // 3. Tertiary: api.country.is
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('https://api.country.is', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data?.country) {
        let countryName = data.country;
        if (typeof Intl !== 'undefined' && Intl.DisplayNames) {
          const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
          countryName = regionNames.of(data.country) || data.country;
        }
        return {
          country: countryName,
          state: '',
          city: '',
          locationString: countryName,
        };
      }
    }
  } catch (e) {
    // fallback
  }

  // 4. Timezone fallback (returns country code, convert to country name)
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      const parts = tz.split('/');
      const regionCode = parts[0]; // Get "Africa" from "Africa/Lagos"
      if (typeof Intl !== 'undefined' && Intl.DisplayNames) {
        const regionNames = new Intl.DisplayNames(['en'], {
          type: 'region',
        });
        const countryName = regionNames.of(regionCode);
        if (countryName && countryName !== regionCode) {
          return {
            country: countryName,
            state: '',
            city: '',
            locationString: countryName,
          };
        }
      }
    }
  } catch (e) {
    // fallback
  }

  return {
    country: 'Unknown',
    state: '',
    city: '',
    locationString: 'Unknown',
  };
}

export async function detectUserCountry() {
  const details = await detectUserLocationDetails();
  return details.locationString || details.country || 'Unknown';
}
