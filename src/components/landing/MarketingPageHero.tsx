import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type MarketingPageHeroProps = {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  className?: string;
};

export function MarketingPageHero({ eyebrow, title, description, actions, aside, className }: MarketingPageHeroProps) {
  return (
    <section className={cn("relative overflow-hidden pt-32 pb-14 md:pt-36 md:pb-20", className)}>
      <div className="absolute inset-0 premium-grid [mask-image:linear-gradient(to_bottom,black,transparent_88%)]" aria-hidden="true" />
      <div className="absolute inset-0 aurora opacity-80" aria-hidden="true" />
      <div className="marketing-container relative z-10">
        <div className={cn("grid gap-10", aside ? "lg:grid-cols-[0.9fr_1.1fr] lg:items-center" : "max-w-5xl mx-auto text-center")}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
            className={cn(!aside && "mx-auto max-w-4xl")}
          >
            <span className="marketing-eyebrow">{eyebrow}</span>
            <h1 className="marketing-heading mt-5">{title}</h1>
            <div className={cn("marketing-lead mt-6", !aside && "mx-auto max-w-3xl")}>{description}</div>
            {actions && <div className={cn("mt-8 flex flex-col gap-3 sm:flex-row", !aside && "justify-center")}>{actions}</div>}
          </motion.div>

          {aside && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              {aside}
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
