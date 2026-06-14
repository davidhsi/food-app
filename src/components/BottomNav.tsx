"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, SearchIcon, SparkleIcon, UserIcon } from "./icons";

const tabs = [
  { href: "/feed", label: "Feed", Icon: HomeIcon },
  { href: "/search", label: "Search", Icon: SearchIcon },
  { href: "/assistant", label: "AI", Icon: SparkleIcon },
  { href: "/profile", label: "You", Icon: UserIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="absolute bottom-0 inset-x-0 z-30 border-t border-line bg-paper/90 backdrop-blur-xl">
      <div className="flex items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${
                active ? "text-olive" : "text-ink-faint"
              }`}
            >
              <Icon filled={active} width={23} height={23} />
              <span className="text-[10px] font-medium tracking-wide">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
