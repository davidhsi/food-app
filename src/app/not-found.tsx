import Link from "next/link";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <div className="phone-shell flex flex-col items-center justify-center bg-paper px-8 text-center">
      <div className="font-display text-5xl font-semibold tracking-tight text-ink">
        Truffle<span className="text-olive">.</span>
      </div>
      <h1 className="mt-6 font-display text-xl font-semibold text-ink">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        The spot may have moved, or the link is off. Let&apos;s get you back to the gems.
      </p>
      <Link
        href="/feed"
        className="mt-7 rounded-full bg-olive px-6 py-3 text-sm font-semibold text-paper active:scale-95"
      >
        Back to the feed
      </Link>
    </div>
  );
}
