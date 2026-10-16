import { MessageCircle, Send, Share2 } from 'lucide-react';
import { clsx } from 'clsx';
import { GlassCard } from './GlassCard';
import { useDialog } from './useDialog';
import { shareOrDownload, type ShareFile } from '../../lib/share';

// Files are generated *before* this modal opens: navigator.share needs a fresh tap,
// and generating inside the tap handler can take long enough for that to expire.
export interface ShareState {
  heading: string;
  description: string;
  files: ShareFile[];
  /** Extra actions that are plain links, e.g. the invoice as WhatsApp text. */
  links?: { label: string; href: string }[];
}

interface Props {
  state: ShareState;
  onClose: () => void;
}

export function ShareModal({ state, onClose }: Props) {
  const dialogRef = useDialog<HTMLDivElement>(onClose);
  const share = async (item: ShareFile) => {
    try {
      await shareOrDownload(item.file, item.title, item.text);
    } catch (error) {
      // AbortError just means the user closed the share sheet
      if ((error as Error).name !== 'AbortError') console.error(error);
    } finally {
      if (state.files.length + (state.links?.length ?? 0) <= 1) onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="share-heading" ref={dialogRef}>
      <GlassCard className="w-full max-w-sm p-6 text-center">
        <div className="mx-auto w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mb-4 text-green-400">
          <Share2 size={24} />
        </div>
        <h2 id="share-heading" className="text-xl font-bold text-white mb-2">{state.heading}</h2>
        <p className="text-slate-400 text-sm mb-6">{state.description}</p>
        <div className="space-y-3">
          {state.files.map((item, i) => (
            <button
              key={item.file.name}
              onClick={() => share(item)}
              className={clsx(
                "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold active:scale-95 transition-all",
                i === 0
                  ? "bg-green-700 hover:bg-green-600 text-white shadow-lg shadow-green-500/20"
                  : "bg-white/10 hover:bg-white/20 text-white"
              )}
            >
              <Send size={18} />
              Share {item.label}
            </button>
          ))}
          {state.links?.map(link => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white active:scale-95 transition-all"
            >
              <MessageCircle size={18} />
              {link.label}
            </a>
          ))}
          <button onClick={onClose} className="text-slate-500 hover:text-white text-sm py-2">
            Done
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
