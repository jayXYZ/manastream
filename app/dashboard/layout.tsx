"use client";

import { ReactNode } from "react";
import {
  HeartPlus,
  Monitor,
  Settings,
  Trophy,
  Timer as TimerIcon,
  ChevronsRight,
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
  SidebarTrigger,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import Timer from "@/components/timer";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
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
    name: "Life Tracker",
    href: "/lifetracker",
    icon: HeartPlus,
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

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
                    <SidebarMenuButton asChild isActive={isActive}>
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
  const tournamentInfo = useQuery(api.tournaments.getUserTournament);
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
