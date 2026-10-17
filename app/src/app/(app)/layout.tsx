import { AppSidebar } from "@/components/app-sidebar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1">
      <AppSidebar />
      <main className="flex-1 p-6 md:p-10">{children}</main>
    </div>
  );
}
