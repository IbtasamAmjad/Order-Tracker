import { Icon } from "./Icon";

/** "Download" button for a photo. href is the photo's own URL; the server sends it as a file (it checks who is asking). */
export function DownloadLink({ href, label = "Download photo", className = "" }: { href: string; label?: string; className?: string }) {
  return (
    <a
      href={`${href.split("?")[0]}?download=1`}
      download
      className={`btn btn-quiet h-auto min-h-11 gap-2 px-4 py-2 text-base ${className}`}
    >
      <Icon name="download" className="h-5 w-5 shrink-0" />
      {label}
    </a>
  );
}
