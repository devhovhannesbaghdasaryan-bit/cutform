'use client';

import { Button } from '@/components/ui/button';
import { socialLoginAction } from '@/app/(auth)/actions';

// Facebook temporarily disabled - keep the copy/action wiring intact for re-enabling later.
const providers = [{ id: 'google', copyKey: 'google', mark: 'G' }] as const;

export type SocialLoginCopy = {
  socialOptions: string;
  google: string;
  useEmail: string;
};

export function SocialLoginButtons({ next, copy }: { next: string; copy: SocialLoginCopy }) {
  return (
    <div className="space-y-5">
      {/* biome-ignore lint/a11y/useSemanticElements: div+role="group" preserves existing markup; a native fieldset's default browser chrome is not desired here */}
      <div className="grid gap-2" role="group" aria-label={copy.socialOptions}>
        {providers.map((provider) => (
          <form action={socialLoginAction} key={provider.id}>
            <input type="hidden" name="provider" value={provider.id} />
            <input type="hidden" name="next" value={next} />
            <Button type="submit" variant="outline" className="w-full justify-start gap-3">
              <span
                aria-hidden="true"
                className="flex size-5 items-center justify-center rounded-full text-xs font-bold"
              >
                {provider.mark}
              </span>
              {copy[provider.copyKey]}
            </Button>
          </form>
        ))}
      </div>

      <div
        className="flex items-center gap-3 text-xs uppercase text-muted-foreground"
        aria-hidden="true"
      >
        <span className="h-px flex-1 bg-border" />
        {copy.useEmail}
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
