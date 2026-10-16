import { redirect } from "next/navigation";
import { getCurrentUser, type User } from "./api";

/** The logged-in user. Sends anyone who isn't logged in to the login page. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
