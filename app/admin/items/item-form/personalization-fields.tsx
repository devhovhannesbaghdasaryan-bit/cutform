import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PERSONALIZATION_TAGS } from '@/lib/personalization-constants';
import { AutogenerateButton } from './ai-context';
import type { BoilerplateOption, ItemFormValue } from './types';

const TAG_LABELS: Record<(typeof PERSONALIZATION_TAGS)[number], string> = {
  personal_color: 'Personal Color',
  personal_text: 'Personal Text',
  personal_photo: 'Personal Photo',
};

export function PersonalizationFields({
  item,
  boilerplateOptions,
  selectedBoilerplateIds,
}: {
  item?: Pick<ItemFormValue, 'system_prompt' | 'skill_id' | 'tags'>;
  boilerplateOptions: BoilerplateOption[];
  selectedBoilerplateIds: string[];
}) {
  const selected = new Set(selectedBoilerplateIds);
  const tags = new Set(item?.tags ?? []);

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="systemPrompt">System prompt</Label>
          <AutogenerateButton field="systemPrompt" />
        </div>
        <Textarea
          id="systemPrompt"
          name="systemPrompt"
          defaultValue={item?.system_prompt ?? ''}
          placeholder="Base generation instructions for this item's AI personalization."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="skillId">Skill ID</Label>
        <Input
          id="skillId"
          name="skillId"
          defaultValue={item?.skill_id ?? ''}
          placeholder="Opaque reference to an OpenAI Assistant/Skill resource"
        />
      </div>
      <div className="space-y-2">
        <Label>Tags</Label>
        <div className="flex flex-wrap gap-4">
          {PERSONALIZATION_TAGS.map((tag) => (
            <label key={tag} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="tags" value={tag} defaultChecked={tags.has(tag)} />
              {TAG_LABELS[tag]}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Boilerplates</Label>
        {boilerplateOptions.length ? (
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {boilerplateOptions.map((boilerplate) => (
              <label
                key={boilerplate.id}
                className="flex items-center gap-2 rounded-md border p-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="boilerplateIds"
                  value={boilerplate.id}
                  defaultChecked={selected.has(boilerplate.id)}
                />
                {boilerplate.name}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No boilerplates yet. Add some in the{' '}
            <a href="/admin/personalization/boilerplates" className="underline">
              boilerplate library
            </a>{' '}
            first.
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        At least one of System prompt, Skill ID, or a selected boilerplate is required when
        Customizable is checked.
      </p>
    </div>
  );
}
