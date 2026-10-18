import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Boxes, ClipboardList, CreditCard, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const t = await getTranslations();
  const [
    { count: itemCount },
    { count: orderCount },
    { count: reviewCount },
    { count: userCount },
    { count: transactionCount },
  ] = await Promise.all([
    supabase.from('catalog_items').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase
      .from('generated_items')
      .select('id', { count: 'exact', head: true })
      .eq('review_status', 'review_required'),
    supabase.from('profiles').select('user_id', { count: 'exact', head: true }),
    supabase.from('transactions').select('id', { count: 'exact', head: true }),
  ]);

  return (
    <main className="container space-y-8 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('adminOverview.title')}</h1>
          <p className="text-muted-foreground">{t('adminOverview.subtitle')}</p>
        </div>
        <Button asChild>
          <Link href="/admin/items/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('adminOverview.newItem')}
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title={t('adminOverview.catalogItems')}
          value={itemCount ?? 0}
          href="/admin/items"
          icon={Boxes}
        />
        <MetricCard
          title={t('adminOverview.orders')}
          value={orderCount ?? 0}
          href="/admin/orders"
          icon={ClipboardList}
        />
        <MetricCard
          title={t('adminOverview.needsReview')}
          value={reviewCount ?? 0}
          href="/admin/generated"
          icon={ClipboardList}
        />
        <MetricCard
          title={t('adminOverview.users')}
          value={userCount ?? 0}
          href="/admin/users"
          icon={Users}
        />
        <MetricCard
          title={t('adminOverview.transactions')}
          value={transactionCount ?? 0}
          href="/admin/transactions"
          icon={CreditCard}
        />
      </div>
    </main>
  );
}

function MetricCard({
  title,
  value,
  href,
  icon: Icon,
}: {
  title: string;
  value: number;
  href: string;
  icon: typeof Boxes;
}) {
  return (
    <Link href={href} className="block focus:outline-none">
      <Card className="transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{value}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
