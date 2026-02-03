import CollegeAdminLayout from "./CollegeAdminLayout";
import CollegeUserList from "./CollegeUserList";

export default function CollegeUsersPage() {
    return (
        <CollegeAdminLayout>
            <CollegeUserList role="all" title="All Users" />
        </CollegeAdminLayout>
    );
}
