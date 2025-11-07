import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
} from "@/components/ui/sidebar";

export default function RightSidebar() {
  return (
    <Sidebar side="right" className="mt-16">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Right Sidebar</SidebarGroupLabel>
          <SidebarGroupContent>RightSidebarContent</SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );

  return <div>RightSidebar</div>;
}
