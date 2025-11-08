import Link from "next/link";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <LoginHeader />
      <div className="flex-1 h-full">{children}</div>
    </div>
  );
}

function LoginHeader() {
  return (
    <header className="sticky top-0 z-10 bg-sidebar h-16 border-b-1 flex flex-row items-center p-4 w-full">
      <Link href="/">ManaStream</Link>
    </header>
  );
}
