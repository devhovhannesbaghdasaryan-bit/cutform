import Link from 'next/link';
import { LogOut, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logoutAction } from '@/app/(auth)/actions';

export function SiteHeader({ email, hideCreate }: { email: string; hideCreate?: boolean }) {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between gap-4">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          Snip
        </Link>
        <div className="flex items-center gap-2">
          {!hideCreate && (
            <Button asChild size="sm">
              <Link href="/create">
                <Plus className="mr-1 h-4 w-4" /> Create new
              </Link>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                {email}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="font-normal text-muted-foreground">
                Signed in
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <form action={logoutAction}>
                <DropdownMenuItem asChild>
                  <button type="submit" className="flex w-full items-center">
                    <LogOut className="mr-2 h-4 w-4" /> Log out
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
