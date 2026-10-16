export function BackendDown() {
  return (
    <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200">
      Prelegal couldn’t load its documents because the backend isn’t reachable. Start it with{" "}
      <code>scripts/start</code> and refresh the page.
    </p>
  );
}
