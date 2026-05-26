import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Video, Coins, Settings, Sparkles } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const items = [
  { title: "Home", url: "/", icon: Home, enabled: true },
  { title: "Vídeos", url: "/dashboard", icon: Video, enabled: true },
  { title: "Créditos", url: "#credits", icon: Coins, enabled: false },
  { title: "Configurações", url: "#settings", icon: Settings, enabled: false },
];

export function AppSidebar() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <span className="font-mono text-xs tracking-wider group-data-[collapsible=icon]:hidden">
            CLIP/FORGE
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild={item.enabled}
                    isActive={item.enabled && currentPath === item.url}
                    tooltip={item.enabled ? item.title : `${item.title} — em breve`}
                    className={!item.enabled ? "cursor-not-allowed opacity-50" : ""}
                  >
                    {item.enabled ? (
                      <Link to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    ) : (
                      <div>
                        <item.icon />
                        <span>{item.title}</span>
                      </div>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
