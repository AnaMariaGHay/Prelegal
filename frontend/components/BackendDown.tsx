import { ui } from "@/lib/ui";

export function BackendDown() {
  return (
    <p role="alert" className={ui.errorBox}>
      Prelegal couldn’t load its documents because the backend isn’t reachable. Start it with{" "}
      <code>scripts/start</code> and refresh the page.
    </p>
  );
}
