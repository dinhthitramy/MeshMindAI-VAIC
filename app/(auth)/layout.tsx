export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="grid min-h-dvh place-items-center bg-muted/25 px-4 py-8 sm:px-6">
      <main className="w-full max-w-108">{children}</main>
    </div>
  );
}
