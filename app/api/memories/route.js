export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { handleGetMemoriesRequest } from '../../../src/server/manuscript-core.js';

export async function GET(request) {
  return handleGetMemoriesRequest(request);
}
