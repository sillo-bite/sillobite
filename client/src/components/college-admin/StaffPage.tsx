import CollegeAdminLayout from "./CollegeAdminLayout";
import CollegeUserList from "./CollegeUserList";

export default function StaffPage() {
    return (
        <CollegeAdminLayout>
            <CollegeUserList role="staff" title="Staff Management" />
        </CollegeAdminLayout>
    );
}
