'use client';

import Link from 'next/link';
import {
  Coins,
  LayoutDashboard,
  LayoutGrid,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
  UserCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toggleTheme } from '@/components/theme-toggle';

export interface MobileNavLabels {
  menu: string;
  theme: string;
  catalog: string;
  credits: string;
  dashboard: string;
  admin: string;
  profile: string;
  login: string;
  signup: string;
}

/**
 * Sub-`sm` replacement for the header's hidden text links. Renders nothing on
 * desktop (`sm:hidden`); receives all state and strings as props so the
 * server-rendered header stays the only data owner.
 */
export function MobileNavMenu({
  isAuthenticated,
  isAdmin,
  creditBalance,
  labels,
}: {
  isAuthenticated: boolean;
  isAdmin: boolean;
  creditBalance: number;
  labels: MobileNavLabels;
}) {
  return (
    <div className="sm:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={labels.menu}>
            <Menu className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[12rem]">
          <DropdownMenuItem asChild>
            <Link href="/catalog" className="cursor-pointer">
              <LayoutGrid className="mr-2 h-4 w-4" />
              {labels.catalog}
            </Link>
          </DropdownMenuItem>
          {isAuthenticated ? (
            <>
              <DropdownMenuItem asChild>
                <Link href="/credits" className="cursor-pointer">
                  <Coins className="mr-2 h-4 w-4" />
                  {labels.credits} · {creditBalance}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard" className="cursor-pointer">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  {labels.dashboard}
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="cursor-pointer">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    {labels.admin}
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer">
                  <UserCircle className="mr-2 h-4 w-4" />
                  {labels.profile}
                </Link>
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem asChild>
                <Link href="/login" className="cursor-pointer">
                  {labels.login}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/register" className="cursor-pointer">
                  {labels.signup}
                </Link>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={(event) => {
              event.preventDefault();
              toggleTheme();
            }}
          >
            <Sun className="mr-2 h-4 w-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
            <Moon className="absolute mr-2 h-4 w-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
            {labels.theme}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
