'use client';

import { LogOut } from 'lucide-react';
import { logoutAction } from '@/app/(auth)/actions';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';

export function LogoutMenuItem({ label = 'Log out' }: { label?: string }) {
  return (
    <form action={logoutAction}>
      <DropdownMenuItem asChild onSelect={(event) => event.preventDefault()}>
        <button type="submit" className="flex w-full items-center">
          <LogOut className="mr-2 h-4 w-4" />
          {label}
        </button>
      </DropdownMenuItem>
    </form>
  );
}
