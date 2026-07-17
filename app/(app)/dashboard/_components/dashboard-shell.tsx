"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  X,
} from "lucide-react";

import { SkipLink } from "@/components/skip-link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigationItems = [
  { href: "/dashboard", label: "Home", icon: House, exact: true },
  { href: "/dashboard/menu", label: "Menu", icon: MenuIcon, exact: false },
];

type SidebarPanelProps = {
  collapsed?: boolean;
  mobile?: boolean;
  onClose?: () => void;
  onToggle?: () => void;
};

function SidebarPanel({
  collapsed = false,
  mobile = false,
  onClose,
  onToggle,
}: SidebarPanelProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-sidebar-border px-3",
          collapsed ? "justify-center" : "justify-end",
        )}
      >
        {mobile ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close navigation"
            onClick={onClose}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <X />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            onClick={onToggle}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        )}
      </div>

      <nav aria-label="Dashboard navigation" className="flex-1 space-y-1 p-3">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              onClick={mobile ? onClose : undefined}
              className={cn(
                "group/nav relative flex h-10 items-center rounded-lg text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-sidebar-ring/30",
                collapsed ? "justify-center px-0" : "gap-3 px-3",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon aria-hidden="true" className="size-4.5 shrink-0" strokeWidth={1.8} />
              <span className={collapsed ? "sr-only" : undefined}>{item.label}</span>
              {collapsed && (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-full z-50 ml-3 rounded-md bg-foreground px-2 py-1 text-xs font-medium whitespace-nowrap text-background opacity-0 shadow-md transition-opacity group-hover/nav:opacity-100 group-focus-visible/nav:opacity-100"
                >
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button
          type="button"
          disabled
          title={collapsed ? "Account" : undefined}
          className={cn(
            "flex h-11 w-full items-center rounded-lg border border-sidebar-border bg-sidebar px-3 text-sm font-medium text-sidebar-foreground/55",
            collapsed ? "justify-center" : "gap-3",
          )}
        >
          <UserRound aria-hidden="true" className="size-4.5 shrink-0" strokeWidth={1.8} />
          <span className={collapsed ? "sr-only" : undefined}>Account</span>
        </button>
      </div>
    </aside>
  );
}

type DashboardShellProps = {
  children: ReactNode;
};

function DashboardShell({ children }: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (mobileOpen && !dialog.open) {
      dialog.showModal();
    } else if (!mobileOpen && dialog.open) {
      dialog.close();
    }
  }, [mobileOpen]);

  function closeMobileSidebar() {
    setMobileOpen(false);
  }

  function handleDialogClose() {
    setMobileOpen(false);
    mobileTriggerRef.current?.focus();
  }

  return (
    <div className="min-h-dvh bg-background">
      <SkipLink href="#dashboard-content" />

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border transition-[width] duration-200 ease-out motion-reduce:transition-none md:block",
          collapsed ? "w-20" : "w-64",
        )}
      >
        <SidebarPanel
          collapsed={collapsed}
          onToggle={() => setCollapsed((current) => !current)}
        />
      </div>

      <div
        className={cn(
          "min-h-dvh transition-[padding] duration-200 ease-out motion-reduce:transition-none",
          collapsed ? "md:pl-20" : "md:pl-64",
        )}
      >
        <header className="flex h-14 items-center border-b px-3 md:hidden">
          <Button
            ref={mobileTriggerRef}
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon />
          </Button>
        </header>
        <main
          id="dashboard-content"
          className="min-h-[calc(100dvh-3.5rem)] md:min-h-dvh"
        >
          {children}
        </main>
      </div>

      <dialog
        ref={dialogRef}
        aria-label="Dashboard navigation"
        onClose={handleDialogClose}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeMobileSidebar();
          }
        }}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(20rem,calc(100vw-2rem))] max-w-none border-0 bg-transparent p-0 text-left shadow-2xl outline-none backdrop:bg-foreground/25 md:hidden"
      >
        <SidebarPanel mobile onClose={closeMobileSidebar} />
      </dialog>
    </div>
  );
}

export { DashboardShell };
