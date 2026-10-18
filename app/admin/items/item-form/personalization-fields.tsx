import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PERSONALIZATION_TAGS } from '@/lib/personalization-constants';
import { AutogenerateButton } from './ai-context';
import type { BoilerplateOption, ItemFormValue } from './types';

const TAG_LABEL_KEYS = {
  personal_color: 'adminItems.personalization.tagLabels.personalColor',
  personal_text: 'adminItems.personalization.tagLabels.personalText',
  personal_photo: 'adminItems.personalization.tagLabels.personalPhoto',
} as const satisfies Record<(typeof PERSONALIZATION_TAGS)[number], string>;

export function PersonalizationFields({
  item,
  boilerplateOptions,
  selectedBoilerplateIds,
}: {
  item?: Pick<ItemFormValue, 'system_prompt' | 'skill_id' | 'skill_path' | 'tags'>;
  boilerplateOptions: BoilerplateOption[];
  selectedBoilerplateIds: string[];
}) {
  const t = useTranslations();
  const selected = new Set(selectedBoilerplateIds);
  const tags = new Set(item?.tags ?? []);

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="systemPrompt">{t('adminItems.personalization.systemPrompt')}</Label>
          <AutogenerateButton field="systemPrompt" />
        </div>
        <Textarea
          id="systemPrompt"
          name="systemPrompt"
          defaultValue={item?.system_prompt ?? ''}
          placeholder={t('adminItems.personalization.systemPromptPlaceholder')}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="skillFile">{t('adminItems.personalization.skillFile')}</Label>
        <Input
          id="skillFile"
          name="skillFile"
          type="file"
          accept=".md,.txt,text/markdown,text/plain"
        />
        <p className="text-xs text-muted-foreground">
          {t('adminItems.personalization.skillFileHelp')}
        </p>
        {item?.skill_id ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {t('adminItems.personalization.attachedSkill')}{' '}
              <code>{item.skill_id.slice(0, 24)}…</code>
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="removeSkill" />{' '}
              {t('adminItems.personalization.removeSkill')}
            </label>
          </div>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label>{t('adminItems.personalization.tags')}</Label>
        <div className="flex flex-wrap gap-4">
          {PERSONALIZATION_TAGS.map((tag) => (
            <label key={tag} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="tags" value={tag} defaultChecked={tags.has(tag)} />
              {t(TAG_LABEL_KEYS[tag])}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t('adminItems.personalization.boilerplates')}</Label>
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
            {t.rich('adminItems.personalization.noBoilerplates', {
              link: (chunks) => (
                <a href="/admin/personalization/boilerplates" className="underline">
                  {chunks}
                </a>
              ),
            })}
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{t('adminItems.personalization.requirement')}</p>
    </div>
  );
}
