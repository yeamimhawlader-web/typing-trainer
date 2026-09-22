/**
 * shadcn/ui's class-name helper: joins class names, and where two Tailwind
 * utilities set the same thing, keeps the later one — so a component's
 * defaults can be overridden by the `className` it is given.
 *
 * Only for the Tailwind components in src/components/ui. The application's own
 * components use CSS modules and `cx` from @shared/lib.
 */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs))
