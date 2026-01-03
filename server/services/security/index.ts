/**
 * Security Services Index
 * 
 * Export all security services for easy imports
 */

export { aiSafetyGuard, type SafetyCheckResult, type SafetyIssue } from './aiSafetyGuard';
export { immutabilityGuard, protectImmutableRecord, type LockOptions, type LockCheckResult, type TamperContext } from './immutabilityGuard';
