import React from 'react';
import { TopBanner } from './TopBanner';

export { TopBanner };

/**
 * BugReportBanner: Full-width top bar (~44px) matching user reference.
 * Text: Found a bug? Report it with /bugreport and earn 50 credits if your server is listed. New
 * Dismiss key: connectingerlc_bug_banner_closed
 */
export function BugReportBanner() {
  return <TopBanner />;
}
