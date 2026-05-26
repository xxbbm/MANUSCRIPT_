export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { handleListModelsRequest } from '../../../src/server/manuscript-core.js';

export async function POST(request) {
  return handleListModelsRequest(request);
}
