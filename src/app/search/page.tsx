import { redirect } from "next/navigation";

// Search was merged into the Discover home (/feed): browse by default, type to
// search. This route is kept only to redirect any old links/bookmarks.
export default function SearchPage() {
  redirect("/feed");
}
