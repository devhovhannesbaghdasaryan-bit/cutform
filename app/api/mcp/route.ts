export const runtime = 'nodejs';

import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import {
  createCatalogItemInputShape,
  handleCreateCatalogItem,
} from '@/lib/mcp/tools/create-catalog-item';
import { getCatalogItemInputShape, handleGetCatalogItem } from '@/lib/mcp/tools/get-catalog-item';
import { handleListCategories, listCategoriesInputShape } from '@/lib/mcp/tools/list-categories';
import {
  handleListSubcategories,
  listSubcategoriesInputShape,
} from '@/lib/mcp/tools/list-subcategories';
import {
  handleUpdateCatalogItem,
  updateCatalogItemInputShape,
} from '@/lib/mcp/tools/update-catalog-item';
import { requireAuthedUserId } from '@/lib/mcp/tools/context';
import { MCP_OAUTH_SCOPE } from '@/lib/mcp/oauth-store';
import { verifyAccessToken } from '@/lib/mcp/verify-token';

function toolError(error: unknown) {
  return {
    content: [
      { type: 'text' as const, text: error instanceof Error ? error.message : 'Tool call failed.' },
    ],
    isError: true as const,
  };
}

function toolResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value) }] };
}

const handler = createMcpHandler((server) => {
  server.tool(
    'create_catalog_item',
    'Create a new hidden-draft (unpublished) catalog item from a short admin brief. You (the assistant) write the title and localized SEO copy yourself and include them in this call — the admin only supplies description, image URL, price, and category.',
    createCatalogItemInputShape,
    async (args, extra) => {
      try {
        return toolResult(await handleCreateCatalogItem(args, requireAuthedUserId(extra)));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.tool(
    'update_catalog_item',
    'Patch an existing catalog item created by create_catalog_item. Only send the fields that should change; omitted fields keep their current value, except seo, which fully replaces the previous SEO copy when sent.',
    updateCatalogItemInputShape,
    async (args, extra) => {
      try {
        return toolResult(await handleUpdateCatalogItem(args, requireAuthedUserId(extra)));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.tool(
    'get_catalog_item',
    'Read the current values of a catalog item by id.',
    getCatalogItemInputShape,
    async (args, extra) => {
      try {
        return toolResult(await handleGetCatalogItem(args, requireAuthedUserId(extra)));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.tool(
    'list_categories',
    'List active catalog categories, for resolving a categoryId before calling create_catalog_item.',
    listCategoriesInputShape,
    async (_args, extra) => {
      try {
        return toolResult(await handleListCategories(requireAuthedUserId(extra)));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.tool(
    'list_subcategories',
    'List active subcategories for a given category id.',
    listSubcategoriesInputShape,
    async (args, extra) => {
      try {
        return toolResult(await handleListSubcategories(args, requireAuthedUserId(extra)));
      } catch (error) {
        return toolError(error);
      }
    },
  );
});

const authHandler = withMcpAuth(handler, verifyAccessToken, {
  required: true,
  requiredScopes: [MCP_OAUTH_SCOPE],
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
});

export { authHandler as GET, authHandler as POST };
