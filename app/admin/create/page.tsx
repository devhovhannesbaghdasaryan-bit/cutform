import Link from 'next/link';
import { Boxes, ImagePlus, Sparkles } from 'lucide-react';
import { generateToyDecorationDraftAction } from '@/app/admin/items/ai-draft-actions';
import { requireAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const actions = [
  {
    href: '/admin/items/new',
    title: 'Catalog item',
    description: 'Create toys, decorations, constructors, night lights, and standard products.',
    icon: Boxes,
  },
  {
    href: '/personalization/night-lights',
    title: 'Personalized model',
    description: 'Publish or replace Night lights > Personalized model templates.',
    icon: Sparkles,
  },
  {
    href: '/admin/generated',
    title: 'Review generated items',
    description: 'Approve, reject, and inspect AI-generated user assets before ordering.',
    icon: ImagePlus,
  },
];

export default async function AdminCreatePage() {
  await requireAdmin();

  return (
    <main className="container max-w-5xl space-y-8 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create</h1>
        <p className="text-muted-foreground">
          Choose the admin workflow for new marketplace content or generated assets.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-lg border p-5 transition-colors hover:bg-muted/40"
            >
              <Icon className="h-6 w-6" />
              <h2 className="mt-4 text-lg font-semibold">{action.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
              <span className="mt-4 inline-flex rounded-md border px-3 py-2 text-sm font-medium">
                Open
              </span>
            </Link>
          );
        })}
      </div>

      <section className="rounded-lg border p-5">
        <div>
          <h2 className="text-lg font-semibold">Generate toy or decoration draft</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a draft catalog item with editable name, description, sizes, image, and
            admin-only characteristics.
          </p>
        </div>
        <form
          action={generateToyDecorationDraftAction}
          className="mt-5 grid gap-4 md:grid-cols-[180px_1fr]"
        >
          <div className="space-y-2">
            <label htmlFor="targetCategory" className="text-sm font-medium">
              Target
            </label>
            <select
              id="targetCategory"
              name="targetCategory"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              required
            >
              <option value="toys">Toys</option>
              <option value="decorations">Decorations</option>
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="prompt" className="text-sm font-medium">
              Prompt
            </label>
            <textarea
              id="prompt"
              name="prompt"
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Describe the item shape, style, intended use, material direction, and finishing expectations."
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="referenceFile" className="text-sm font-medium">
              Reference image
            </label>
            <input
              id="referenceFile"
              name="referenceFile"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="block w-full text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Uploading only an image generates editable metadata from the image path and marks
              uncertain materials/specs as review-required.
            </p>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Generate editable draft
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
