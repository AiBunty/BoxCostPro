import { ReactNode } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Wrapper component that only renders if user has permission
 */
export function PermissionGuard({
  action,
  fallback,
  children,
}: {
  action: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { hasPermission, isLoading } = useAdminAuth();

  if (isLoading) return null;

  if (!hasPermission(action)) {
    return fallback || null;
  }

  return <>{children}</>;
}

/**
 * Display permission denied message
 */
export function PermissionDenied({ action }: { action: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        You don't have permission to {action.replace(/_/g, " ").toLowerCase()}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Button that disables if user lacks permission
 */
export function PermissionButton({
  action,
  children,
  ...props
}: {
  action: string;
  children: ReactNode;
} & React.ComponentProps<typeof Button>) {
  const { hasPermission, isLoading } = useAdminAuth();

  const isDisabled = isLoading || !hasPermission(action);

  return (
    <Button
      {...props}
      disabled={isDisabled}
      title={
        isDisabled && !isLoading
          ? `You don't have permission to perform this action`
          : props.title
      }
    >
      {children}
      {isDisabled && !isLoading && " (restricted)"}
    </Button>
  );
}

/**
 * Badge showing user's role
 */
export function RoleBadge() {
  const { role } = useAdminAuth();

  if (!role) return null;

  const roleColors: Record<string, string> = {
    SUPER_ADMIN: "bg-red-100 text-red-800",
    SUPPORT_STAFF: "bg-blue-100 text-blue-800",
    MARKETING_STAFF: "bg-green-100 text-green-800",
    FINANCE_ADMIN: "bg-purple-100 text-purple-800",
  };

  const displayRole = role
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");

  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
        roleColors[role] || "bg-gray-100 text-gray-800"
      }`}
    >
      {displayRole}
    </span>
  );
}

/**
 * Show action logged indicator for state-changing operations
 */
export function ActionLogged() {
  return (
    <span className="text-xs text-gray-500 ml-2">
      (All actions are logged for compliance)
    </span>
  );
}
