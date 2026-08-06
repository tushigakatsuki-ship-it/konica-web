import { CONTACT } from '../data/site';

export default function Footer() {
  return (
    <footer className="bg-ink py-8 text-center text-sm text-white/70">
      <p>
        © {new Date().getFullYear()}{' '}
        <span className="font-semibold text-white">{CONTACT.company}</span>. Бүх эрх
        хуулиар хамгаалагдсан.
      </p>
    </footer>
  );
}
