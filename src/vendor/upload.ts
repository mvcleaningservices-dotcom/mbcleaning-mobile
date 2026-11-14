import type { ImagePickerOptions } from 'expo-image-picker';
import { api } from '../api';

/**
 * expo-image-picker is a native module added in V2. It's loaded only when the
 * vendor taps a photo button, so an older installed build (made before the
 * module existed) still opens normally — only that button reports an error.
 */
async function loadPicker() {
  try {
    return await import('expo-image-picker');
  } catch {
    throw new Error('Photo upload needs the latest app version. Please update the app.');
  }
}

export interface UploadedImage {
  secureUrl: string;
  publicId: string;
  format: string;
}

/**
 * Pick an image from the gallery or camera. Returns null if cancelled.
 * Compressed (quality 0.6) and returned as base64, which uploads the same way
 * on Android, iOS and web.
 */
export async function pickImage(source: 'camera' | 'library', square: boolean) {
  const ImagePicker = await loadPicker();
  const opts: ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.6,
    base64: true,
    allowsEditing: square, // crop UI for the profile photo only
    aspect: square ? [1, 1] : undefined,
  };
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Camera permission is needed to take a photo.');
  }
  const res =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]?.base64) return null;
  const a = res.assets[0];
  return { base64: a.base64!, mimeType: a.mimeType || 'image/jpeg' };
}

/**
 * Upload to Cloudinary with a signature from our backend. The backend decides
 * the folder (and makes documents private), so the app can't change either.
 */
export async function uploadImage(
  token: string,
  kind: 'photo' | 'document',
  image: { base64: string; mimeType: string },
): Promise<UploadedImage> {
  const sig = await api.vendorUploadSignature(token, kind);
  const form = new FormData();
  form.append('file', `data:${image.mimeType};base64,${image.base64}`);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('folder', sig.folder);
  form.append('signature', sig.signature);
  if (sig.type) form.append('type', sig.type);

  let json: any;
  try {
    const res = await fetch(sig.uploadUrl, { method: 'POST', body: form });
    json = await res.json();
    if (!res.ok || !json?.secure_url) throw new Error(json?.error?.message || 'Upload failed');
  } catch (e: any) {
    throw new Error(e?.message?.includes('Network') ? 'Upload failed — check your internet and try again.' : e?.message || 'Upload failed');
  }
  return { secureUrl: json.secure_url, publicId: json.public_id, format: json.format || 'jpg' };
}
