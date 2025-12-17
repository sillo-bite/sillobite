import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, CreditCard, Smartphone, Wallet, Plus, Trash2 } from "lucide-react";

export default function PaymentMethodsPage() {
  const [, setLocation] = useLocation();
  const [selectedMethod, setSelectedMethod] = useState("cash");
  const [savedCards, setSavedCards] = useState([
    {
      id: 1,
      type: "visa",
      last4: "4567",
      expiryMonth: "12",
      expiryYear: "26",
      holderName: "Rahul Kumar"
    }
  ]);

  const paymentMethods = [
    {
      id: "cash",
      name: "Cash on Pickup",
      description: "Pay when you collect your order",
      icon: Wallet,
      enabled: true
    },
    {
      id: "upi",
      name: "UPI Payment",
      description: "Razorpay, Google Pay, UPI, Cards, etc.",
      icon: Smartphone,
      enabled: true
    },
    {
      id: "card",
      name: "Credit/Debit Card",
      description: "Visa, Mastercard, RuPay",
      icon: CreditCard,
      enabled: true
    }
  ];

  const removeCard = (cardId: number) => {
    setSavedCards(prev => prev.filter(card => card.id !== cardId));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-red-600 px-4 pt-12 pb-6 rounded-b-2xl">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" className="text-white" onClick={() => setLocation('/profile')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-white">Payment Methods</h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Available Payment Methods */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-4">Available Payment Methods</h3>
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className={`flex items-center space-x-4 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedMethod === method.id 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:bg-accent/50"
                  }`}
                  onClick={() => setSelectedMethod(method.id)}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    selectedMethod === method.id ? "bg-primary text-white" : "bg-muted"
                  }`}>
                    <method.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{method.name}</p>
                    <p className="text-sm text-muted-foreground">{method.description}</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 ${
                    selectedMethod === method.id 
                      ? "border-primary bg-primary" 
                      : "border-muted-foreground"
                  }`}>
                    {selectedMethod === method.id && (
                      <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Saved Cards */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Saved Cards</h3>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Card
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Card</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <label className="text-sm font-medium">Card Number</label>
                      <Input placeholder="1234 5678 9012 3456" className="mt-1" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Expiry Date</label>
                        <Input placeholder="MM/YY" className="mt-1" />
                      </div>
                      <div>
                        <label className="text-sm font-medium">CVV</label>
                        <Input placeholder="123" className="mt-1" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Cardholder Name</label>
                      <Input placeholder="John Doe" className="mt-1" />
                    </div>
                    <Button variant="food" className="w-full">
                      Add Card
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {savedCards.length > 0 ? (
              <div className="space-y-3">
                {savedCards.map((card) => (
                  <div key={card.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">**** **** **** {card.last4}</p>
                        <p className="text-sm text-muted-foreground">
                          Expires {card.expiryMonth}/{card.expiryYear} • {card.holderName}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCard(card.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No saved cards</p>
                <p className="text-sm text-muted-foreground">Add a card for faster checkout</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Digital Wallets */}
        <Card className="shadow-card">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-4">Digital Wallets</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <span className="text-blue-500 font-bold text-sm">GPay</span>
                  </div>
                  <div>
                    <p className="font-medium">Google Pay</p>
                    <p className="text-sm text-success">Connected</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Disconnect
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <span className="text-purple-500 font-bold text-sm">PE</span>
                  </div>
                  <div>
                    <p className="font-medium">Razorpay</p>
                    <p className="text-sm text-muted-foreground">Not connected</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Connect
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center">
                    <span className="text-cyan-500 font-bold text-sm">Pay</span>
                  </div>
                  <div>
                    <p className="font-medium">Paytm</p>
                    <p className="text-sm text-muted-foreground">Not connected</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Connect
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Note */}
        <Card className="shadow-card border-warning">
          <CardContent className="p-4">
            <h3 className="font-semibold text-warning mb-2">Security Information</h3>
            <p className="text-sm text-muted-foreground">
              Your payment information is encrypted and stored securely. Our system never stores your full card details.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}