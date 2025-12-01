"use client";

import { ReactNode } from "react";
import {
  Monitor,
  Settings,
  Trophy,
  Timer as TimerIcon,
  ChevronsRight,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarFooter,
  useSidebar,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { NavUser } from "@/components/auth/nav-user";

const navigationItems = [
  {
    name: "Controllers",
    href: "/dashboard/controllers",
    icon: Trophy,
  },
  {
    name: "Overlays",
    href: "/dashboard/overlays",
    icon: Monitor,
  },
  {
    name: "Timer",
    href: "/dashboard/timer",
    icon: TimerIcon,
  },
  {
    name: "Players",
    href: "/dashboard/players",
    icon: User,
  },
];

const settingsNavigationItem = {
  name: "Settings",
  href: "/dashboard/settings",
  icon: Settings,
};

function DashboardSidebar() {
  const pathname = usePathname();
  const { state, toggleSidebar } = useSidebar();

  return (
    <Sidebar collapsible="icon" className="z-1 bg-sidebar">
      <SidebarContent className="pt-16">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.name}
                    >
                      <Link href={item.href}>
                        <Icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <div className="px-2">
          <SidebarSeparator className="mx-0" />
        </div>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === settingsNavigationItem.href}
                  tooltip={settingsNavigationItem.name}
                >
                  <Link href={settingsNavigationItem.href}>
                    <Settings className="h-4 w-4" />
                    <span>{settingsNavigationItem.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleSidebar}>
              <ChevronsRight
                className={`transition-transform duration-500 ease-in-out ${
                  state === "expanded" ? "rotate-y-180" : "rotate-y-0"
                }`}
              />
              <span>Toggle</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function DashboardHeader() {
  return (
    <header className="sticky top-0 z-10 bg-sidebar h-16 border-b-1 flex flex-row justify-between items-center p-4 w-full">
      <Link href="/">ManaStream</Link>
      <NavUser />
    </header>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <DashboardHeader />
      <div className="flex-1 min-h-0">
        <SidebarProvider>
          <DashboardSidebar />
          <SidebarInset className="overflow-hidden">
            <main className="h-full overflow-auto">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </div>
  );
}
