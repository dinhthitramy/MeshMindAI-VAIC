type SkipLinkProps = {
  href: string;
};

function SkipLink({ href }: SkipLinkProps) {
  return (
    <a
      href={href}
      className="fixed left-4 top-4 z-100 -translate-y-24 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transition-none"
    >
      Skip to content
    </a>
  );
}

export { SkipLink };
