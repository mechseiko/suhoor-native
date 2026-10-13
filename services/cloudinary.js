// Cloudinary Service for Suhoor Profile Pictures
import { Platform } from 'react-native';

const CLOUDINARY_CLOUD_NAME = 'h7yxeeqk';
const CLOUDINARY_API_KEY = '552674894174143';
const CLOUDINARY_API_SECRET = 'YTBw3SzpYdCbhlQOjC3x1-B2sQQ';
const FOLDER_NAME = 'suhoorProfilePictures';

/**
 * Pure JavaScript SHA-1 implementation (RFC 3174)
 * Guaranteed cross-platform without native crypto module dependencies.
 */
function sha1(str) {
  function rotateLeft(n, s) {
    return (n << s) | (n >>> (32 - s));
  }
  function cvtHex(val) {
    let out = '';
    for (let i = 7; i >= 0; i--) {
      const v = (val >>> (i * 4)) & 0x0f;
      out += v.toString(16);
    }
    return out;
  }

  const utf8 = unescape(encodeURIComponent(str));
  const words = [];
  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }
  const len = utf8.length * 8;
  words[len >> 5] |= 0x80 << (24 - (len % 32));
  words[(((len + 64) >> 9) << 4) + 15] = len;

  let H0 = 0x67452301;
  let H1 = 0xefcdab89;
  let H2 = 0x98badcfe;
  let H3 = 0x10325476;
  let H4 = 0xc3d2e1f0;
  const W = new Array(80);

  for (let i = 0; i < words.length; i += 16) {
    for (let t = 0; t < 16; t++) W[t] = words[i + t] || 0;
    for (let t = 16; t < 80; t++) W[t] = rotateLeft(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);

    let A = H0;
    let B = H1;
    let C = H2;
    let D = H3;
    let E = H4;

    for (let t = 0; t < 80; t++) {
      let f, K;
      if (t < 20) {
        f = (B & C) | (~B & D);
        K = 0x5a827999;
      } else if (t < 40) {
        f = B ^ C ^ D;
        K = 0x6ed9eba1;
      } else if (t < 60) {
        f = (B & C) | (B & D) | (C & D);
        K = 0x8f1bbcdc;
      } else {
        f = B ^ C ^ D;
        K = 0xca62c1d6;
      }
      const temp = (rotateLeft(A, 5) + f + E + K + W[t]) | 0;
      E = D;
      D = C;
      C = rotateLeft(B, 30);
      B = A;
      A = temp;
    }

    H0 = (H0 + A) | 0;
    H1 = (H1 + B) | 0;
    H2 = (H2 + C) | 0;
    H3 = (H3 + D) | 0;
    H4 = (H4 + E) | 0;
  }

  return [H0, H1, H2, H3, H4].map(cvtHex).join('').toLowerCase();
}

/**
 * Generate signed parameters for Cloudinary API
 */
function generateSignature(params) {
  const sortedKeys = Object.keys(params).sort();
  const serialized = sortedKeys.map((k) => `${k}=${params[k]}`).join('&');
  return sha1(serialized + CLOUDINARY_API_SECRET);
}

/**
 * Upload an image file (URI / Blob / Base64) to Cloudinary
 * @param {string|object} file - file URI on native or File/Blob object on web
 * @param {string} userId - current user's UID
 * @returns {Promise<{ url: string, publicId: string }>}
 */
export async function uploadProfilePicture(file, userId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${FOLDER_NAME}/user_${userId}`;

  const paramsToSign = {
    folder: FOLDER_NAME,
    overwrite: 'true',
    public_id: publicId,
    timestamp: String(timestamp),
  };

  const signature = generateSignature(paramsToSign);

  const formData = new FormData();
  formData.append('api_key', CLOUDINARY_API_KEY);
  formData.append('timestamp', String(timestamp));
  formData.append('folder', FOLDER_NAME);
  formData.append('public_id', publicId);
  formData.append('overwrite', 'true');
  formData.append('signature', signature);

  if (Platform.OS === 'web') {
    if (file instanceof File || file instanceof Blob) {
      formData.append('file', file);
    } else if (typeof file === 'string') {
      formData.append('file', file);
    }
  } else {
    // React Native format
    formData.append('file', {
      uri: typeof file === 'string' ? file : file.uri,
      type: file.type || 'image/jpeg',
      name: file.name || `avatar_${userId}.jpg`,
    });
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to upload profile picture to Cloudinary');
  }

  return {
    url: data.secure_url,
    publicId: data.public_id,
  };
}

/**
 * Delete a profile picture from Cloudinary
 * @param {string} publicId - Cloudinary public_id
 */
export async function deleteProfilePicture(publicId) {
  if (!publicId) return;

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    public_id: publicId,
    timestamp: String(timestamp),
  };

  const signature = generateSignature(paramsToSign);

  const formData = new FormData();
  formData.append('public_id', publicId);
  formData.append('api_key', CLOUDINARY_API_KEY);
  formData.append('timestamp', String(timestamp));
  formData.append('signature', signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`,
    {
      method: 'POST',
      body: formData,
    }
  );

  const data = await response.json();
  return data;
}

/**
 * Replace a profile picture on Cloudinary (uploads new image over same publicId)
 */
export async function replaceProfilePicture(file, userId) {
  return uploadProfilePicture(file, userId);
}
