'use client';
import { motion, type HTMLMotionProps } from 'framer-motion';
import clsx from 'clsx';

interface ButtonOwnProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

type ButtonProps = ButtonOwnProps & Omit<HTMLMotionProps<'button'>, keyof ButtonOwnProps | 'children'>;

const variantClasses: Record<NonNullable<ButtonOwnProps['variant']>, string> = {
  primary:
    'bg-sky-600 hover:bg-sky-500 text-white border border-sky-500 disabled:bg-sky-900 disabled:border-sky-900',
  secondary:
    'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 disabled:bg-slate-800 disabled:text-slate-500',
  danger:
    'bg-red-700 hover:bg-red-600 text-white border border-red-600 disabled:bg-red-900 disabled:border-red-900',
  ghost:
    'bg-transparent hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-40',
};

const sizeClasses: Record<NonNullable<ButtonOwnProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-md',
  md: 'px-4 py-2 text-base rounded-lg',
  lg: 'px-6 py-3 text-lg rounded-xl',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      {...rest}
      disabled={isDisabled}
      whileHover={!isDisabled ? { scale: 1.03 } : {}}
      whileTap={!isDisabled ? { scale: 0.97 } : {}}
      className={clsx(
        'font-semibold transition-colors duration-150 disabled:cursor-not-allowed flex items-center justify-center gap-2',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {loading && (
        <motion.span
          className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent shrink-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
        />
      )}
      {children}
    </motion.button>
  );
}
