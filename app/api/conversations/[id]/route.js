export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { handleDeleteConversationRequest } from '../../../../src/server/manuscript-core.js';

export async function DELETE(request, { params }) {
  const { id } = await params;
  return handleDeleteConversationRequest(request, decodeURIComponent(id));
}
