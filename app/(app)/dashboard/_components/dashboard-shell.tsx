"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  House,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  UserRound,
  X,
} from "lucide-react";

import { SkipLink } from "@/components/skip-link";
import { ThemeSelector } from "@/components/theme-selector";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/(auth)/actions";

const navigationItems = [
  { href: "/dashboard", label: "Home", icon: House, exact: true },
  { href: "/dashboard/menu", label: "Menu", icon: MenuIcon, exact: false },
];

type SidebarPanelProps = {
  collapsed?: boolean;
  closeButtonRef?: RefObject<HTMLButtonElement | null>;
  mobile?: boolean;
  viewer: DashboardViewer;
  onClose?: () => void;
  onNavigate?: () => void;
  onToggle?: () => void;
};

type SidebarNavigationLinkProps = {
  collapsed: boolean;
  isActive: boolean;
  item: (typeof navigationItems)[number];
  onNavigate?: () => void;
};

function SidebarNavigationLink({
  collapsed,
  isActive,
  item,
  onNavigate,
}: SidebarNavigationLinkProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      onNavigate={onNavigate}
      onPointerEnter={() => setTooltipOpen(true)}
      onPointerLeave={(event) => {
        if (document.activeElement !== event.currentTarget) {
          setTooltipOpen(false);
        }
      }}
      onFocus={() => setTooltipOpen(true)}
      onBlur={() => setTooltipOpen(false)}
      className={cn(
        "group/nav relative flex h-10 items-center rounded-lg text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-sidebar-ring/30 motion-reduce:transition-none",
        collapsed ? "justify-center px-0" : "gap-3 px-3",
        isActive
          ? "text-sidebar-accent-foreground"
          : "text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
      )}
    >
      {isActive && (
        <motion.span
          layoutId="active-dashboard-navigation"
          aria-hidden="true"
          className="absolute inset-0 rounded-lg bg-sidebar-accent"
          transition={{ duration: 0.18 }}
        />
      )}
      <Icon
        aria-hidden="true"
        className="relative z-10 size-4.5 shrink-0"
        strokeWidth={1.8}
      />
      {collapsed && <span className="sr-only">{item.label}</span>}
      <AnimatePresence initial={false} mode="popLayout">
        {!collapsed && (
          <motion.span
            key="label"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.14 }}
            className="relative z-10"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {collapsed && tooltipOpen && (
          <motion.span
            key="tooltip"
            role="tooltip"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -2 }}
            transition={{ duration: 0.14 }}
            className="pointer-events-none absolute left-full z-50 ml-3 rounded-md bg-foreground px-2 py-1 text-xs font-medium whitespace-nowrap text-background shadow-md"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}

function SidebarPanel({
  collapsed = false,
  closeButtonRef,
  mobile = false,
  viewer,
  onClose,
  onNavigate,
  onToggle,
}: SidebarPanelProps) {
  const pathname = usePathname();

  return (
    <LayoutGroup id={mobile ? "mobile-dashboard-navigation" : "desktop-dashboard-navigation"}>
      <aside className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-sidebar-border px-3",
            collapsed ? "justify-center" : "justify-end",
          )}
        >
          {mobile ? (
            <Button
              ref={closeButtonRef}
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
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={collapsed ? "expand" : "collapse"}
                  initial={{ opacity: 0, rotate: -8 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 8 }}
                  transition={{ duration: 0.12 }}
                  className="flex"
                >
                  {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                </motion.span>
              </AnimatePresence>
            </Button>
          )}
        </div>

        <nav aria-label="Dashboard navigation" className="flex-1 space-y-1 p-3">
          {navigationItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <SidebarNavigationLink
                key={item.href}
                item={item}
                isActive={isActive}
                collapsed={collapsed}
                onNavigate={mobile ? onNavigate : undefined}
              />
            );
          })}
        </nav>

        <div className="flex flex-col gap-2 border-t border-sidebar-border p-3">
          <ThemeSelector
            compact={collapsed}
            className={
              collapsed
                ? "text-sidebar-foreground hover:bg-sidebar-accent"
                : "w-full"
            }
          />

          <form action={logoutAction}>
            <button
              type="submit"
              title={collapsed ? "Log out" : undefined}
              aria-label={collapsed ? `Log out ${viewer.displayName}` : undefined}
              className={cn(
                "flex min-h-11 w-full items-center rounded-lg border border-sidebar-border bg-sidebar px-3 text-left text-sm outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-sidebar-ring/30 motion-reduce:transition-none",
                collapsed ? "justify-center" : "gap-3",
              )}
            >
              <UserRound
                aria-hidden="true"
                className="size-4.5 shrink-0"
                strokeWidth={1.8}
              />

              <AnimatePresence initial={false} mode="popLayout">
                {!collapsed && (
                  <motion.span
                    key="viewer"
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -4 }}
                    transition={{ duration: 0.14 }}
                    className="min-w-0 flex-1"
                  >
                    <span className="block truncate font-medium">
                      {viewer.displayName}
                    </span>
                    <span className="block truncate text-xs text-sidebar-foreground/55">
                      {viewer.roleLabel}
                    </span>
                  </motion.span>
                )}
              </AnimatePresence>

              <AnimatePresence initial={false} mode="popLayout">
                {!collapsed && (
                  <motion.span
                    key="logout"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className="flex"
                  >
                    <LogOut
                      aria-hidden="true"
                      className="size-4 shrink-0 text-sidebar-foreground/55"
                    />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </form>
        </div>
      </aside>
    </LayoutGroup>
  );
}

type DashboardShellProps = {
  children: ReactNode;
  viewer: DashboardViewer;
};

type DashboardViewer = {
  displayName: string;
  roleLabel: string;
};

function DashboardShell({ children, viewer }: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const restoreMobileTriggerRef = useRef(true);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (mobileOpen) {
      mobileCloseButtonRef.current?.focus();
    }
  }, [mobileOpen]);

  function openMobileSidebar() {
    const dialog = dialogRef.current;

    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    restoreMobileTriggerRef.current = true;
    setMobileOpen(true);
  }

  function dismissMobileSidebar() {
    restoreMobileTriggerRef.current = true;
    setMobileOpen(false);
  }

  function closeMobileSidebarForNavigation() {
    restoreMobileTriggerRef.current = false;
    setMobileOpen(false);
  }

  function finishMobileSidebarClose() {
    const dialog = dialogRef.current;

    if (dialog?.open) {
      dialog.close();
    }
  }

  function handleDialogClose() {
    setMobileOpen(false);

    if (restoreMobileTriggerRef.current) {
      mobileTriggerRef.current?.focus();
    }

    restoreMobileTriggerRef.current = true;
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
          viewer={viewer}
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
            onClick={openMobileSidebar}
          >
            <MenuIcon />
          </Button>
          <ThemeSelector compact className="ml-auto" />
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
        onCancel={(event) => {
          event.preventDefault();
          dismissMobileSidebar();
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-transparent p-0 text-left outline-none backdrop:bg-transparent md:hidden"
      >
        <AnimatePresence onExitComplete={finishMobileSidebarClose}>
          {mobileOpen && (
            <motion.div
              key="mobile-navigation"
              initial="closed"
              animate="open"
              exit="closed"
              className="absolute inset-0"
            >
              <motion.div
                aria-hidden="true"
                variants={{
                  closed: { opacity: 0 },
                  open: { opacity: 1 },
                }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.14 }}
                onClick={dismissMobileSidebar}
                className="absolute inset-0 bg-foreground/25"
              />
              <motion.div
                variants={{
                  closed: { opacity: 0, x: shouldReduceMotion ? 0 : -24 },
                  open: { opacity: 1, x: 0 },
                }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
                className="relative h-full w-[min(20rem,calc(100vw-2rem))] shadow-2xl"
              >
                <SidebarPanel
                  mobile
                  closeButtonRef={mobileCloseButtonRef}
                  viewer={viewer}
                  onClose={dismissMobileSidebar}
                  onNavigate={closeMobileSidebarForNavigation}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </dialog>
    </div>
  );
}

export { DashboardShell };
