import { Redirect } from 'expo-router';

import { captureHref } from '@/lib/routes';

export default function HailTestRedirect() {
  return <Redirect href={captureHref('test-squares')} />;
}
