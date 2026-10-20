import { MessageCircle, Send, Share2 } from 'lucide-react';
import { clsx } from 'clsx';
import { Card } from './Card';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, BUTTON_GHOST, OVERLAY_CLASS } from './styles';
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
    <div className={OVERLAY_CLASS} role="dialog" aria-modal="true" aria-labelledby="share-heading" ref={dialogRef}>
      <Card className="w-full max-w-sm p-6 text-center shadow-raised">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-tint text-primary">
          <Share2 size={24} aria-hidden="true" />
        </div>
        <h2 id="share-heading" className="mb-2 text-xl font-bold text-ink">{state.heading}</h2>
        <p className="mb-6 text-sm text-muted">{state.description}</p>
        <div className="space-y-3">
          {state.files.map((item, i) => (
            <button
              key={item.file.name}
              onClick={() => share(item)}
              className={clsx(i === 0 ? BUTTON_PRIMARY : BUTTON_SECONDARY, 'w-full')}
            >
              <Send size={18} aria-hidden="true" />
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
              className={clsx(BUTTON_SECONDARY, 'w-full')}
            >
              <MessageCircle size={18} aria-hidden="true" />
              {link.label}
            </a>
          ))}
          <button onClick={onClose} className={clsx(BUTTON_GHOST, 'w-full')}>
            Done
          </button>
        </div>
      </Card>
    </div>
  );
}
