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
  SidebarHeader,
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
      {/* <SidebarHeader className="border-b h-16 flex justify-center pl-6">
        <Link href="/dashboard">
          <h1 className="text-xl font-semibold">DxC Overlay</h1>
        </Link>
      </SidebarHeader> */}
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
            {/* <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 justify-between">
          <SidebarTrigger className="-ml-1" />
          <Link
            href="/dashboard/timer"
            className="flex items-center gap-1 cursor-pointer text-black hover:text-blue-500 transition-colors bg-blue-300 p-2 rounded-full font-semibold text-lg px-4"
          >
            <TimerIcon className="size-5" />
            {tournamentInfo && <Timer tournamentInfo={tournamentInfo} />}
          </Link>
        </header> */}

            <main className="h-full overflow-auto">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </div>
  );
}
