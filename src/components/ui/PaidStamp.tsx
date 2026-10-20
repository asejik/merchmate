import { motion } from 'framer-motion';

/**
 * The one celebratory moment: when an invoice is settled, a PAID stamp presses onto the page once
 * (400ms). Decorative: the dialog's heading and text already say it. Reduced motion shows it still.
 */
export function PaidStamp() {
  return (
    <motion.div
      aria-hidden="true"
      initial={{ scale: 1.7, opacity: 0, rotate: -2 }}
      animate={{ scale: 1, opacity: 1, rotate: -7 }}
      transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
      className="mx-auto mb-4 w-fit rounded-lg border-[3px] border-success px-5 py-1 text-3xl font-extrabold tracking-[0.2em] text-success"
    >
      PAID
    </motion.div>
  );
}
