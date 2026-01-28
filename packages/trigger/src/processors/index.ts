import type { FilingProcessor } from "./types.js";

/**
 * Registry of filing processors keyed by form type.
 * Multiple form types can map to the same processor (e.g., "4" and "4/A").
 */
const processorRegistry = new Map<string, FilingProcessor>();

/**
 * Register a processor for its supported form types.
 * Each form type from processor.formTypes will be mapped to this processor.
 *
 * @param processor - The processor to register
 * @throws Error if a form type is already registered
 *
 * @example
 * ```typescript
 * registerProcessor(new Form4Processor());
 * // Now "4" and "4/A" form types are handled by Form4Processor
 * ```
 */
export function registerProcessor(processor: FilingProcessor): void {
  for (const formType of processor.formTypes) {
    if (processorRegistry.has(formType)) {
      throw new Error(
        `Processor for form type "${formType}" is already registered`,
      );
    }
    processorRegistry.set(formType, processor);
  }
}

/**
 * Get the processor for a given form type.
 *
 * @param formType - The form type to get a processor for (e.g., "4", "4/A")
 * @returns The registered processor, or undefined if none registered
 */
export function getProcessor(formType: string): FilingProcessor | undefined {
  return processorRegistry.get(formType);
}

/**
 * Check if a processor is registered for a form type.
 *
 * @param formType - The form type to check
 * @returns true if a processor is registered
 */
export function hasProcessor(formType: string): boolean {
  return processorRegistry.has(formType);
}

/**
 * Get all registered form types.
 *
 * @returns Array of all registered form types
 */
export function getRegisteredFormTypes(): string[] {
  return Array.from(processorRegistry.keys());
}

/**
 * Clear all registered processors.
 * Primarily useful for testing.
 */
export function clearProcessors(): void {
  processorRegistry.clear();
}

// Re-export types
export type {
  FilingProcessor,
  ProcessorContext,
  ProcessorResult,
} from "./types.js";
