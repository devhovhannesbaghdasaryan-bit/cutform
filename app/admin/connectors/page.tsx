import { getTranslations } from 'next-intl/server';
import { revokeConnectorAction } from '@/app/admin/connectors/actions';
import { Button } from '@/components/ui/button';
import { requireAdmin } from '@/lib/admin';
import { listConnectedApps } from '@/lib/mcp/oauth-store';
import { getRequestLocale } from '@/lib/i18n-server';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminConnectorsPage() {
  const { supabase, user } = await requireAdmin();
  const [connectedApps, t, locale] = await Promise.all([
    listConnectedApps(supabase, user.id),
    getTranslations(),
    getRequestLocale(),
  ]);

  return (
    <main className="container max-w-3xl space-y-8 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('adminConnectors.title')}</h1>
        <p className="text-muted-foreground">
          {t('adminConnectors.subtitle', {
            endpoint: `{${t('adminConnectors.yourUrl')}}/api/mcp`,
          })}
        </p>
      </div>

      {connectedApps.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('adminConnectors.empty')}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">{t('adminConnectors.app')}</th>
                <th className="px-4 py-3 font-medium">{t('adminConnectors.accessExpires')}</th>
                <th className="px-4 py-3 font-medium">{t('adminConnectors.connectionExpires')}</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">{t('adminConnectors.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {connectedApps.map((app) => (
                <tr key={app.tokenId} className="border-t">
                  <td className="px-4 py-3 font-medium">{app.clientName}</td>
                  <td className="px-4 py-3">{formatDate(app.expiresAt, locale)}</td>
                  <td className="px-4 py-3">{formatDate(app.refreshExpiresAt, locale)}</td>
                  <td className="px-4 py-3 text-right">
                    <form action={revokeConnectorAction}>
                      <input type="hidden" name="tokenId" value={app.tokenId} />
                      <Button type="submit" variant="destructive" size="sm">
                        {t('adminConnectors.revoke')}
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
