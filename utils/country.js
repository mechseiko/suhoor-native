/**
 * Utility to detect the user's country and state on sign-up using fast, lightweight geolocation APIs
 * with an automatic fallback to timezone.
 * Returns formatted location like "Lagos, Nigeria" or "Nigeria".
 */

const TIMEZONE_TO_LOCATION = {
  Lagos: 'Lagos, Nigeria',
  Abuja: 'Abuja, Nigeria',
  Kano: 'Kano, Nigeria',
  Cairo: 'Cairo, Egypt',
  Riyadh: 'Riyadh, Saudi Arabia',
  Jeddah: 'Jeddah, Saudi Arabia',
  Dubai: 'Dubai, United Arab Emirates',
  Doha: 'Doha, Qatar',
  Kuwait: 'Kuwait City, Kuwait',
  Amman: 'Amman, Jordan',
  Casablanca: 'Casablanca, Morocco',
  London: 'London, United Kingdom',
  New_York: 'New York, United States',
  Chicago: 'Chicago, United States',
  Los_Angeles: 'Los Angeles, United States',
  Toronto: 'Toronto, Canada',
  Kuala_Lumpur: 'Kuala Lumpur, Malaysia',
  Jakarta: 'Jakarta, Indonesia',
  Karachi: 'Karachi, Pakistan',
  Dhaka: 'Dhaka, Bangladesh',
  Istanbul: 'Istanbul, Turkey',
  Paris: 'Paris, France',
  Berlin: 'Berlin, Germany',
  Nairobi: 'Nairobi, Kenya',
  Accra: 'Accra, Ghana',
  Johannesburg: 'Johannesburg, South Africa',
};

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
        const state = data.region || data.city || '';
        const country = data.country || '';
        const formatted = state ? `${state}, ${country}` : country;
        return {
          country,
          state,
          city: data.city || '',
          locationString: formatted,
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
        const state = data.region || data.city || '';
        const country = data.country_name || '';
        const formatted = state ? `${state}, ${country}` : country;
        return {
          country,
          state,
          city: data.city || '',
          locationString: formatted,
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

  // 4. Timezone mapping fallback
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      const parts = tz.split('/');
      const cityKey = parts[parts.length - 1];
      if (TIMEZONE_TO_LOCATION[cityKey]) {
        const loc = TIMEZONE_TO_LOCATION[cityKey];
        const [state, country] = loc.split(', ');
        return {
          country: country || state,
          state: state || '',
          city: state || '',
          locationString: loc,
        };
      }
      const fallbackCity = cityKey.replace(/_/g, ' ');
      return {
        country: fallbackCity,
        state: fallbackCity,
        city: fallbackCity,
        locationString: fallbackCity,
      };
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
