export const runtime = 'nodejs';

import { metadataCorsOptionsRequestHandler, protectedResourceHandler } from 'mcp-handler';
import { getServerEnv } from '@/lib/env';

const handler = protectedResourceHandler({
  authServerUrls: [getServerEnv().NEXT_PUBLIC_SITE_URL],
});

const corsHandler = metadataCorsOptionsRequestHandler();

export { handler as GET, corsHandler as OPTIONS };
