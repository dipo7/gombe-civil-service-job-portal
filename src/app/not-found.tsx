import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">The position you are looking for does not exist.</p>
      <Link href="/" className="mt-4 inline-block text-primary underline">
        View open positions
      </Link>
    </div>
  );
}
