import type { Notice } from "@/lib/notify";
import { btn } from "./ui";

/** A calm row with one clear "send on WhatsApp" button (opens WhatsApp with the text ready). */
export function WhatsAppNotice({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  return (
    <div className="panel flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-l-4 !border-l-ok !py-3">
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-base font-medium">{notice.label}</p>
        {!notice.hasNumber && (
          <p className="text-sm text-muted">No WhatsApp number saved for {notice.masterName}. You can pick the chat yourself.</p>
        )}
      </div>
      <a href={notice.link} target="_blank" rel="noreferrer" className={`${btn} !bg-ok-soft !text-ok hover:!brightness-95`}>
        Send on WhatsApp to {notice.masterName}
      </a>
    </div>
  );
}
