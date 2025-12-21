import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ChevronLeft,
  Building2,
  Mail,
  Shield,
  AlertTriangle,
  Eye
} from "lucide-react";
import { Link } from "wouter";

interface AdminStats {
  totalUsers: number;
  pendingVerifications: number;
  approvedUsers: number;
  rejectedUsers: number;
  newSignupsLast7Days: number;
}

interface OnboardingStatus {
  id: string;
  userId: string;
  businessProfileDone: boolean;
  paperSetupDone: boolean;
  fluteSetupDone: boolean;
  taxSetupDone: boolean;
  termsSetupDone: boolean;
  submittedForVerification: boolean;
  verificationStatus: string;
  rejectionReason: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  user?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    role?: string;
    createdAt: string;
  };
  company?: {
    companyName: string;
    gstNumber?: string;
    city?: string;
    state?: string;
  };
}

interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: string;
  createdAt: string;
  onboardingStatus?: OnboardingStatus;
  company?: {
    companyName: string;
  };
}

export default function AdminUsers() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedUser, setSelectedUser] = useState<OnboardingStatus | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [userToEdit, setUserToEdit] = useState<User | null>(null);

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ['/api/admin/stats'],
  });

  const { data: pendingVerifications = [] } = useQuery<OnboardingStatus[]>({
    queryKey: ['/api/admin/verifications/pending'],
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
  });

  const approveMutation = useMutation({
    mutationFn: (userId: string) => apiRequest('POST', `/api/admin/users/${userId}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin'] });
      toast({ title: "User Approved", description: "The user now has full access." });
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Approval Failed", 
        description: error.message || "Could not approve user.",
        variant: "destructive"
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) => 
      apiRequest('POST', `/api/admin/users/${userId}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin'] });
      toast({ title: "User Rejected", description: "The user has been notified." });
      setShowRejectDialog(false);
      setRejectionReason("");
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Rejection Failed", 
        description: error.message || "Could not reject user.",
        variant: "destructive"
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => 
      apiRequest('PATCH', `/api/admin/users/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: "Role Updated", description: "User role has been changed." });
      setShowRoleDialog(false);
      setUserToEdit(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Update Failed", 
        description: error.message || "Could not update role.",
        variant: "destructive"
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">Not Submitted</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    const roleColors: Record<string, string> = {
      'super_admin': 'bg-purple-600',
      'admin': 'bg-blue-600',
      'support_manager': 'bg-teal-600',
      'support_agent': 'bg-cyan-600',
      'user': 'bg-gray-500',
      'owner': 'bg-purple-600',
    };
    return (
      <Badge className={roleColors[role] || 'bg-gray-500'}>
        <Shield className="w-3 h-3 mr-1" />
        {role?.replace('_', ' ') || 'user'}
      </Badge>
    );
  };

  const isSuperAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'owner';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon" data-testid="button-back-admin">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">User Management</h1>
              <p className="text-sm text-muted-foreground">Verify and manage user accounts</p>
            </div>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats?.pendingVerifications || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <UserCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.approvedUsers || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <UserX className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats?.rejectedUsers || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New (7 days)</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats?.newSignupsLast7Days || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              Pending Verifications
              {(stats?.pendingVerifications || 0) > 0 && (
                <Badge variant="secondary" className="ml-1">{stats?.pendingVerifications}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2">
              <Users className="h-4 w-4" />
              All Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending Verifications</CardTitle>
                <CardDescription>Users waiting for account approval</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingVerifications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No pending verifications</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Setup Progress</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingVerifications.map((status) => (
                        <TableRow key={status.id} data-testid={`row-pending-${status.userId}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {[status.user?.firstName, status.user?.lastName].filter(Boolean).join(' ') || 'Unknown'}
                              </p>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {status.user?.email}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {status.company?.companyName || 'Not set'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {[
                                status.businessProfileDone && 'Business',
                                status.paperSetupDone && 'Paper',
                                status.fluteSetupDone && 'Flute',
                                status.taxSetupDone && 'Tax',
                                status.termsSetupDone && 'Terms',
                              ].filter(Boolean).join(', ') || 'None'}
                            </div>
                          </TableCell>
                          <TableCell>
                            {status.submittedAt ? new Date(status.submittedAt).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedUser(status)}
                                data-testid={`button-view-${status.userId}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => approveMutation.mutate(status.userId)}
                                disabled={approveMutation.isPending}
                                className="bg-green-600 hover:bg-green-700"
                                data-testid={`button-approve-${status.userId}`}
                              >
                                <UserCheck className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedUser(status);
                                  setShowRejectDialog(true);
                                }}
                                data-testid={`button-reject-${status.userId}`}
                              >
                                <UserX className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>All Users</CardTitle>
                <CardDescription>Complete list of registered users</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      {isSuperAdmin && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allUsers.map((user) => (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {[user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown'}
                            </p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{user.company?.companyName || '-'}</TableCell>
                        <TableCell>{getRoleBadge(user.role || 'user')}</TableCell>
                        <TableCell>
                          {getStatusBadge(user.onboardingStatus?.verificationStatus || 'not_submitted')}
                        </TableCell>
                        <TableCell>
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                        </TableCell>
                        {isSuperAdmin && (
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setUserToEdit(user);
                                setSelectedRole(user.role || 'user');
                                setShowRoleDialog(true);
                              }}
                              disabled={user.id === currentUser?.id}
                              data-testid={`button-edit-role-${user.id}`}
                            >
                              <Shield className="h-4 w-4 mr-1" />
                              Change Role
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {allUsers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={isSuperAdmin ? 6 : 5} className="text-center text-muted-foreground py-8">
                          No users found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Reject User
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection. This will be shown to the user and is mandatory (minimum 10 characters).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">
                {[selectedUser?.user?.firstName, selectedUser?.user?.lastName].filter(Boolean).join(' ')}
              </p>
              <p className="text-sm text-muted-foreground">{selectedUser?.user?.email}</p>
            </div>
            <Textarea
              placeholder="Enter the reason for rejection (minimum 10 characters)..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              data-testid="input-rejection-reason"
            />
            {rejectionReason.length > 0 && rejectionReason.length < 10 && (
              <Alert variant="destructive">
                <AlertDescription>
                  Reason must be at least 10 characters ({rejectionReason.length}/10)
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={rejectionReason.trim().length < 10 || rejectMutation.isPending}
              onClick={() => selectedUser && rejectMutation.mutate({ 
                userId: selectedUser.userId, 
                reason: rejectionReason.trim() 
              })}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Update the role for {userToEdit?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger data-testid="select-role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="support_agent">Support Agent</SelectItem>
                <SelectItem value="support_manager">Support Manager</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => userToEdit && updateRoleMutation.mutate({ 
                userId: userToEdit.id, 
                role: selectedRole 
              })}
              disabled={updateRoleMutation.isPending}
              data-testid="button-confirm-role-change"
            >
              {updateRoleMutation.isPending ? 'Updating...' : 'Update Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedUser && !showRejectDialog} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">
                    {[selectedUser.user?.firstName, selectedUser.user?.lastName].filter(Boolean).join(' ') || 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedUser.user?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Company</p>
                  <p className="font-medium">{selectedUser.company?.companyName || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">
                    {[selectedUser.company?.city, selectedUser.company?.state].filter(Boolean).join(', ') || 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">GST Number</p>
                  <p className="font-medium">{selectedUser.company?.gstNumber || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Submitted At</p>
                  <p className="font-medium">
                    {selectedUser.submittedAt ? new Date(selectedUser.submittedAt).toLocaleString() : 'Not submitted'}
                  </p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Setup Completion</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={selectedUser.businessProfileDone ? 'default' : 'outline'}>
                    Business Profile
                  </Badge>
                  <Badge variant={selectedUser.paperSetupDone ? 'default' : 'outline'}>
                    Paper Pricing
                  </Badge>
                  <Badge variant={selectedUser.fluteSetupDone ? 'default' : 'outline'}>
                    Flute Settings
                  </Badge>
                  <Badge variant={selectedUser.taxSetupDone ? 'default' : 'outline'}>
                    Tax & Defaults
                  </Badge>
                  <Badge variant={selectedUser.termsSetupDone ? 'default' : 'outline'}>
                    Quote Terms
                  </Badge>
                </div>
              </div>
              
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedUser(null)}>
                  Close
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectDialog(true)}
                >
                  <UserX className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => approveMutation.mutate(selectedUser.userId)}
                  disabled={approveMutation.isPending}
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
