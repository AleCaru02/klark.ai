import { Menu, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { product } from "@/config/product";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const location = useLocation();
  const isHome = location.pathname === "/";

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrollProgress(Math.min(Math.max(window.scrollY / 96, 0), 1));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => setIsOpen(false), [location.pathname]);

  const homeLinks = [
    { label: "Come funziona", href: "#how-it-works" },
    { label: "Soluzioni", href: "#solutions" },
    { label: "Demo", href: "#voice-demo" },
    { label: "Prezzi", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ];

  const sectionHref = (href: string) => (isHome ? href : `/${href}`);
  const effectiveProgress = isOpen ? 1 : scrollProgress;
  const opacity = 0.94 + effectiveProgress * 0.05;
  const borderAlpha = 0.55 + effectiveProgress * 0.35;

  return (
    <nav className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4" aria-label="Navigazione principale">
      <div
        className={cn(
          "pointer-events-auto mx-auto max-w-[1320px] rounded-2xl border backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-150",
          effectiveProgress > 0.18
            ? "shadow-[0_10px_32px_rgba(15,23,42,0.08)]"
            : "shadow-[0_6px_22px_rgba(14,165,233,0.06)]",
        )}
        style={{
          backgroundColor: `rgba(255,255,255,${opacity.toFixed(3)})`,
          borderColor: `rgba(226,232,240,${borderAlpha.toFixed(3)})`,
        }}
      >
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-5 lg:h-[68px] lg:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label={`${product.name} homepage`}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-700 shadow-sm">
              <Phone className="h-4 w-4" aria-hidden="true" />
            </div>
            <span className="text-lg font-extrabold tracking-[-0.04em] text-slate-900">
              Clerk<span className="text-primary">AI</span>
            </span>
          </Link>

          <div className="hidden items-center gap-0.5 lg:flex">
            {homeLinks.map((link) => (
              <a key={link.label} href={sectionHref(link.href)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-sky-50 hover:text-slate-950">
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <Button variant="ghost" size="sm" asChild><Link to="/login">Accedi</Link></Button>
            <Button size="sm" asChild><Link to="/analisi-flusso">Richiedi una demo</Link></Button>
          </div>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm transition-colors hover:bg-sky-50 lg:hidden"
            onClick={() => setIsOpen((open) => !open)}
            aria-label={isOpen ? "Chiudi menu" : "Apri menu"}
            aria-expanded={isOpen}
          >
            {isOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>

        {isOpen && (
          <div className="border-t border-slate-200/80 bg-white px-4 py-4 animate-fade-in lg:hidden">
            <div className="grid gap-1">
              {homeLinks.map((link) => (
                <a key={link.label} href={sectionHref(link.href)} className="rounded-xl px-3 py-3 text-sm font-semibold text-slate-800 hover:bg-sky-50">{link.label}</a>
              ))}
              <Link to="/presentazione" className="rounded-xl px-3 py-3 text-sm font-semibold text-slate-800 hover:bg-sky-50">Presentazione</Link>
              <Link to="/tecnologia" className="rounded-xl px-3 py-3 text-sm font-semibold text-slate-800 hover:bg-sky-50">Come è costruito il servizio</Link>
              <Link to="/carta-servizio" className="rounded-xl px-3 py-3 text-sm font-semibold text-slate-800 hover:bg-sky-50">Carta del servizio</Link>
            </div>
            <div className="mt-3 grid gap-2 border-t border-slate-200/80 pt-4 sm:hidden">
              <Button variant="outline" asChild><Link to="/login">Accedi</Link></Button>
              <Button asChild><Link to="/analisi-flusso">Richiedi una demo</Link></Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
