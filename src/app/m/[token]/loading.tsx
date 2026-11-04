export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <div className="skeleton-block h-9 w-40" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton-block h-28" />
      ))}
    </div>
  );
}
