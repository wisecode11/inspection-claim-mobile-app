import { Redirect } from 'expo-router';

import { captureHref } from '@/lib/routes';

export default function DamageRedirect() {
  return <Redirect href={captureHref('shingles')} />;
}
