import { Redirect } from 'expo-router';

import { captureHref } from '@/lib/routes';

export default function RoofInspectionRedirect() {
  return <Redirect href={captureHref('elevations')} />;
}
