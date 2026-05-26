export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { handleOptimizeMemoriesRequest } from '../../../../src/server/manuscript-core.js';

export async function POST(request) {
  return handleOptimizeMemoriesRequest(request);
}
