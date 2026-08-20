import { Redirect } from 'expo-router';

import { captureHref } from '@/lib/routes';

export default function ChecklistRedirect() {
  return <Redirect href={captureHref('collateral')} />;
}
