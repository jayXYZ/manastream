import Link from "next/link";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-10 bg-panel-background h-16 border-b-2 flex flex-row justify-between items-center p-4">
        <Link href="/">DxC Overlay</Link>
      </header>
      {children}
    </>
  );
}
