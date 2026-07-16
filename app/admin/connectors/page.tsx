import { revokeConnectorAction } from '@/app/admin/connectors/actions';
import { Button } from '@/components/ui/button';
import { requireAdmin } from '@/lib/admin';
import { listConnectedApps } from '@/lib/mcp/oauth-store';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminConnectorsPage() {
  const { supabase, user } = await requireAdmin();
  const connectedApps = await listConnectedApps(supabase, user.id);

  return (
    <main className="container max-w-3xl space-y-8 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Connected apps</h1>
        <p className="text-muted-foreground">
          Apps you've authorized to create and edit catalog items on your behalf via ChatGPT or
          Claude. To connect a new one, add {`{your Uniqraft URL}/api/mcp`} as a custom connector in
          Claude or ChatGPT and sign in when prompted.
        </p>
      </div>

      {connectedApps.length === 0 ? (
        <p className="text-sm text-muted-foreground">No apps connected yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">App</th>
                <th className="px-4 py-3 font-medium">Access expires</th>
                <th className="px-4 py-3 font-medium">Connection expires</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {connectedApps.map((app) => (
                <tr key={app.tokenId} className="border-t">
                  <td className="px-4 py-3 font-medium">{app.clientName}</td>
                  <td className="px-4 py-3">{formatDate(app.expiresAt)}</td>
                  <td className="px-4 py-3">{formatDate(app.refreshExpiresAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <form action={revokeConnectorAction}>
                      <input type="hidden" name="tokenId" value={app.tokenId} />
                      <Button type="submit" variant="destructive" size="sm">
                        Revoke
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
