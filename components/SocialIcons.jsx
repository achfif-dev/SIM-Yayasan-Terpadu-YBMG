import { Instagram, Facebook, Youtube, Twitter, Send, MessageCircle, Globe, Music2, Link2 } from 'lucide-react';
import { socialLinks } from '../lib/tampilan';

const ICONS = {
  instagram: Instagram, facebook: Facebook, youtube: Youtube, tiktok: Music2,
  x: Twitter, telegram: Send, whatsapp: MessageCircle, website: Globe, lainnya: Link2,
};

// variant: 'light' (di atas latar gelap) | 'dark'
export default function SocialIcons({ cfg, className = '' }) {
  const links = socialLinks(cfg);
  if (!links.length) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {links.map((l) => {
        const Icon = ICONS[l.kind] || Link2;
        return (
          <a key={l.kind + l.url} href={l.url} target="_blank" rel="noopener noreferrer" aria-label={l.label} title={l.label}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 text-white transition hover:bg-white/20">
            <Icon size={18} />
          </a>
        );
      })}
    </div>
  );
}
