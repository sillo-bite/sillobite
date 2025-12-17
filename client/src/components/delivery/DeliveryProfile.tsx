import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar,
  Truck,
  CreditCard,
  AlertCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DeliveryProfileProps {
  deliveryPerson: any;
  user: any;
}

export default function DeliveryProfile({ deliveryPerson, user }: DeliveryProfileProps) {
  return (
    <div className="space-y-4">
      {/* Profile Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl">{deliveryPerson.name}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {deliveryPerson.deliveryPersonId}
              </p>
            </div>
            <Badge variant={deliveryPerson.isActive ? "default" : "secondary"}>
              {deliveryPerson.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center space-x-3">
            <Phone className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Phone Number</p>
              <p className="font-medium">{deliveryPerson.phoneNumber}</p>
            </div>
          </div>
          {deliveryPerson.email && (
            <div className="flex items-center space-x-3">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{deliveryPerson.email}</p>
              </div>
            </div>
          )}
          {deliveryPerson.employeeId && (
            <div className="flex items-center space-x-3">
              <CreditCard className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Employee ID</p>
                <p className="font-medium">{deliveryPerson.employeeId}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Address Information */}
      {(deliveryPerson.address || deliveryPerson.city || deliveryPerson.state) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Address</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start space-x-3">
              <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                {deliveryPerson.address && (
                  <p className="text-sm">{deliveryPerson.address}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {[deliveryPerson.city, deliveryPerson.state, deliveryPerson.pincode]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {deliveryPerson.dateOfBirth && (
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Date of Birth</p>
                <p className="font-medium">
                  {new Date(deliveryPerson.dateOfBirth).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
          {deliveryPerson.dateOfJoining && (
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Date of Joining</p>
                <p className="font-medium">
                  {new Date(deliveryPerson.dateOfJoining).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vehicle Information */}
      {(deliveryPerson.vehicleNumber || deliveryPerson.licenseNumber) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vehicle Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {deliveryPerson.vehicleNumber && (
              <div className="flex items-center space-x-3">
                <Truck className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Vehicle Number</p>
                  <p className="font-medium">{deliveryPerson.vehicleNumber}</p>
                </div>
              </div>
            )}
            {deliveryPerson.licenseNumber && (
              <div className="flex items-center space-x-3">
                <CreditCard className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">License Number</p>
                  <p className="font-medium">{deliveryPerson.licenseNumber}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Emergency Contact */}
      {(deliveryPerson.emergencyContact || deliveryPerson.emergencyContactName) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Emergency Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {deliveryPerson.emergencyContactName && (
              <div className="flex items-center space-x-3">
                <User className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Contact Name</p>
                  <p className="font-medium">{deliveryPerson.emergencyContactName}</p>
                </div>
              </div>
            )}
            {deliveryPerson.emergencyContact && (
              <div className="flex items-center space-x-3">
                <Phone className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Contact Number</p>
                  <p className="font-medium">{deliveryPerson.emergencyContact}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Account Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Availability</span>
            <Badge variant={deliveryPerson.isAvailable ? "default" : "secondary"}>
              {deliveryPerson.isAvailable ? "Available" : "Unavailable"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Orders Delivered</span>
            <span className="font-medium">{deliveryPerson.totalOrderDelivered || 0}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
















