export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <div className="skeleton-block h-9 w-48" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton-block h-36" />
        ))}
      </div>
      <div className="skeleton-block h-40" />
    </div>
  );
}
