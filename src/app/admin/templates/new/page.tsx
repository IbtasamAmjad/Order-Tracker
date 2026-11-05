import { redirect } from "next/navigation";

// Groups and categories are made on the Categories page now (a group first, then its categories).
// This address only stays so an old bookmark or link still lands somewhere sensible.
export default function NewCategory() {
  redirect("/admin/templates");
}
