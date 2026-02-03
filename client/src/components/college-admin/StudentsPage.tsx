import CollegeAdminLayout from "./CollegeAdminLayout";
import CollegeUserList from "./CollegeUserList";

export default function StudentsPage() {
    return (
        <CollegeAdminLayout>
            <CollegeUserList role="student" title="Students Management" />
        </CollegeAdminLayout>
    );
}
