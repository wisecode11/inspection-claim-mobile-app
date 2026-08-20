import { Redirect } from 'expo-router';

import { captureHref } from '@/lib/routes';

export default function PhotosRedirect() {
  return <Redirect href={captureHref('elevations')} />;
}
