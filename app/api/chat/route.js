export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { handleChatRequest } from '../../../src/server/manuscript-core.js';

export async function POST(request) {
  return handleChatRequest(request);
}
