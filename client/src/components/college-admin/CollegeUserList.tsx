import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Search,
    MoreVertical,
    Shield,
    Mail,
    Phone,
    School,
    Briefcase
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthSync } from "@/hooks/useDataSync";
import { Pagination } from "@/components/ui/pagination";

interface CollegeUserListProps {
    role: "student" | "staff" | "all";
    title: string;
}

export default function CollegeUserList({ role, title }: CollegeUserListProps) {
    const { user } = useAuthSync();
    const queryClient = useQueryClient();

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

    // Determine the filter role string for the API
    const apiRole = role === "all" ? undefined : role;

    // We assume user.organizationId holds the college ID for the admin
    const collegeId = user?.organizationId;

    // Fetch paginated users
    const { data: usersData, isLoading, refetch } = useQuery({
        queryKey: ['/api/users/paginated', currentPage, itemsPerPage, searchTerm, apiRole, collegeId],
        queryFn: async () => {
            if (!collegeId) return { users: [], totalCount: 0, totalPages: 0 };

            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: itemsPerPage.toString(),
                ...(searchTerm && { search: searchTerm }),
                ...(apiRole && { role: apiRole }),
                college: collegeId.toString(), // Enforce college filter
            });

            const response = await fetch(`/api/users/paginated?${params}`);
            if (!response.ok) {
                throw new Error('Failed to fetch users');
            }
            return response.json();
        },
        enabled: !!collegeId, // Only fetch if we have a college ID
        staleTime: 30000,
    });

    const users = usersData?.users || [];
    const totalPages = usersData?.totalPages || 0;
    const totalCount = usersData?.totalCount || 0;

    // Pagination handlers
    const goToPage = (page: number) => setCurrentPage(page);
    const goToNextPage = () => setCurrentPage(Math.min(currentPage + 1, totalPages));
    const goToPreviousPage = () => setCurrentPage(Math.max(currentPage - 1, 1));

    if (!collegeId) {
        return <div className="p-4">Error: No Organization ID found for current user.</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight">{title} ({totalCount})</h2>
                <div className="flex items-center space-x-2">
                    <div className="relative w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                    {/* Add User Button could go here */}
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Details</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    Loading...
                                </TableCell>
                            </TableRow>
                        ) : users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No users found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            users.map((user: any) => (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <div className="flex items-center space-x-3">
                                            <Avatar>
                                                <AvatarImage src={user.avatar} />
                                                <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="font-medium">{user.name}</div>
                                                <div className="text-sm text-muted-foreground capitalize">{user.role}</div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={user.status === "Active" ? "default" : "destructive"}>
                                            {user.status || "Active"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex items-center space-x-2">
                                                <Mail className="h-3 w-3 text-muted-foreground" />
                                                <span>{user.email}</span>
                                            </div>
                                            {user.phoneNumber && (
                                                <div className="flex items-center space-x-2">
                                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                                    <span>{user.phoneNumber}</span>
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1 text-sm">
                                            {user.registerNumber && (
                                                <div className="flex items-center space-x-2">
                                                    <School className="h-3 w-3 text-muted-foreground" />
                                                    <span>{user.registerNumber}</span>
                                                </div>
                                            )}
                                            {user.department && (
                                                <div className="flex items-center space-x-2">
                                                    <Briefcase className="h-3 w-3 text-muted-foreground" />
                                                    <span>{user.department}</span>
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem>View Details</DropdownMenuItem>
                                                <DropdownMenuItem>Edit User</DropdownMenuItem>
                                                {/* <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          Block User
                        </DropdownMenuItem> */}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPreviousPage()}
                    disabled={currentPage === 1 || isLoading}
                >
                    Previous
                </Button>
                <div className="text-sm font-medium">
                    Page {currentPage} of {totalPages || 1}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToNextPage()}
                    disabled={currentPage === totalPages || isLoading}
                >
                    Next
                </Button>
            </div>
        </div>
    );
}
