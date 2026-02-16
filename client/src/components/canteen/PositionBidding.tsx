import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Building2, GraduationCap, Gavel, Clock, CheckCircle, XCircle, AlertCircle, IndianRupee } from 'lucide-react';
import { format } from 'date-fns';

interface PositionBiddingProps {
  canteenId: string;
}

interface Institution {
  id: string;
  name: string;
  code: string;
  type: 'organization' | 'college';
}

interface CanteenBid {
  id: string;
  name: string;
  priority: number;
  currentBid?: number;
  yourBid?: number;
  bidStatus?: 'pending' | 'closed' | 'paid' | 'active';
  paymentStatus?: 'pending' | 'completed' | 'failed';
  bidId?: string;
}

export default function PositionBidding({ canteenId }: PositionBiddingProps) {
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [biddingCanteens, setBiddingCanteens] = useState<CanteenBid[]>([]);
  const [bidAmounts, setBidAmounts] = useState<Record<string, number>>({});
  const [targetDate, setTargetDate] = useState<Date>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  });

  // Fetch canteen details to get available institutions
  const { data: canteenData } = useQuery({
    queryKey: [`/api/system-settings/canteens/${canteenId}`],
    queryFn: async () => {
      return await apiRequest(`/api/system-settings/canteens/${canteenId}`);
    },
    enabled: !!canteenId,
  });

  const canteen = canteenData;

  // Fetch institutions (organizations and colleges) the canteen is available in
  const { data: institutionsData } = useQuery({
    queryKey: ['bidding-institutions', canteenId],
    queryFn: async () => {
      const institutions: Institution[] = [];

      // Fetch organizations
      if (canteen?.organizationIds && canteen.organizationIds.length > 0) {
        for (const orgId of canteen.organizationIds) {
          try {
            const org = await apiRequest(`/api/system-settings/organizations/${orgId}`);
            if (org?.organization) {
              institutions.push({
                id: orgId,
                name: org.organization.name,
                code: org.organization.code,
                type: 'organization',
              });
            }
          } catch (error) {
            console.error(`Error fetching organization ${orgId}:`, error);
          }
        }
      }

      // Fetch colleges
      if (canteen?.collegeIds && canteen.collegeIds.length > 0) {
        for (const collegeId of canteen.collegeIds) {
          try {
            const college = await apiRequest(`/api/system-settings/colleges/${collegeId}`);
            if (college?.college) {
              institutions.push({
                id: collegeId,
                name: college.college.name,
                code: college.college.code,
                type: 'college',
              });
            }
          } catch (error) {
            console.error(`Error fetching college ${collegeId}:`, error);
          }
        }
      }

      return institutions;
    },
    enabled: !!canteen,
  });

  // Fetch canteens for selected institution with bidding data
  const { data: canteensData, refetch: refetchCanteens } = useQuery({
    queryKey: ['bidding-canteens', selectedInstitution?.id, selectedInstitution?.type, targetDate],
    queryFn: async () => {
      if (!selectedInstitution) return null;

      const endpoint = selectedInstitution.type === 'organization'
        ? `/api/system-settings/canteens/by-organization/${selectedInstitution.id}`
        : `/api/system-settings/canteens/by-college/${selectedInstitution.id}`;

      const response = await apiRequest(endpoint);
      const canteens = response?.canteens || [];

      // Fetch all bids for this institution and date
      const bidsResponse = await apiRequest(
        `/api/bidding/bids?institutionId=${selectedInstitution.id}&institutionType=${selectedInstitution.type}&targetDate=${targetDate.toISOString()}`
      );
      const allBids = bidsResponse?.bids || [];

      // Create a map of canteenId -> bid
      const bidMap = new Map<string, any>(allBids.map((bid: any) => [bid.canteenId, bid]));

      // Merge canteens with their bids
      const canteensWithBids: CanteenBid[] = canteens.map((canteen: any) => {
        const bid = bidMap.get(canteen.id);
        return {
          ...canteen,
          currentBid: bid?.bidAmount || 0,
          yourBid: canteen.id === canteenId ? bid?.bidAmount : undefined,
          bidStatus: bid?.status,
          paymentStatus: bid?.paymentStatus,
          bidId: bid?.bidId,
        };
      });

      // Sort by current bid amount (highest first), then by priority
      return canteensWithBids.sort((a: CanteenBid, b: CanteenBid) => {
        if (b.currentBid !== a.currentBid) {
          return (b.currentBid || 0) - (a.currentBid || 0);
        }
        return (a.priority || 0) - (b.priority || 0);
      });
    },
    enabled: !!selectedInstitution,
  });

  useEffect(() => {
    if (canteensData) {
      setBiddingCanteens(canteensData);
    }
  }, [canteensData]);

  // Create bid mutation
  const createBidMutation = useMutation({
    mutationFn: async ({ amount, canteenId: bidCanteenId }: { amount: number; canteenId: string }) => {
      return await apiRequest('/api/bidding/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canteenId: bidCanteenId,
          organizationId: selectedInstitution?.type === 'organization' ? selectedInstitution.id : undefined,
          collegeId: selectedInstitution?.type === 'college' ? selectedInstitution.id : undefined,
          targetDate: targetDate.toISOString(),
          bidAmount: amount,
        }),
      });
    },
    onSuccess: () => {
      refetchCanteens();
      setBidAmounts({});
    },
  });

  // Check bidding status
  const now = new Date();
  const biddingCloseTime = new Date(targetDate);
  biddingCloseTime.setDate(biddingCloseTime.getDate() - 1);
  biddingCloseTime.setHours(13, 0, 0, 0); // 1 PM day before

  const paymentDueTime = new Date(targetDate);
  paymentDueTime.setDate(paymentDueTime.getDate() - 1);
  paymentDueTime.setHours(15, 0, 0, 0); // 3 PM day before

  const isBiddingOpen = now < biddingCloseTime;
  const isPaymentWindow = now >= biddingCloseTime && now < paymentDueTime;
  const isAfterPaymentWindow = now >= paymentDueTime;

  const handleBid = (canteenIdForBid: string) => {
    const amount = bidAmounts[canteenIdForBid];
    if (!amount || amount <= 0) {
      alert('Please enter a valid bid amount');
      return;
    }

    if (confirm(`Place a bid of ₹${(amount / 100).toFixed(2)} for position?`)) {
      createBidMutation.mutate({ amount, canteenId: canteenIdForBid });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Bid for Position</h2>
          <p className="text-muted-foreground">
            Bid for priority positions in organizations and colleges
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">Target Date</div>
          <div className="font-semibold">{format(targetDate, 'MMM dd, yyyy')}</div>
        </div>
      </div>

      {/* Bidding Status */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {isBiddingOpen && (
                <>
                  <Badge variant="default" className="bg-green-500">
                    <Clock className="w-3 h-3 mr-1" />
                    Bidding Open
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Closes at {format(biddingCloseTime, 'MMM dd, yyyy hh:mm a')}
                  </span>
                </>
              )}
              {isPaymentWindow && (
                <>
                  <Badge variant="default" className="bg-yellow-500">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Payment Window
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Payment due by {format(paymentDueTime, 'MMM dd, yyyy hh:mm a')}
                  </span>
                </>
              )}
              {isAfterPaymentWindow && (
                <>
                  <Badge variant="default" className="bg-gray-500">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Closed
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Bidding and payment window closed
                  </span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Institution Selection */}
      {!selectedInstitution && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Select Institution</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {institutionsData?.map((institution) => (
              <Card
                key={institution.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedInstitution(institution)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-3">
                    {institution.type === 'organization' ? (
                      <Building2 className="w-8 h-8 text-blue-500" />
                    ) : (
                      <GraduationCap className="w-8 h-8 text-green-500" />
                    )}
                    <div>
                      <h4 className="font-semibold">{institution.name}</h4>
                      <p className="text-sm text-muted-foreground">{institution.code}</p>
                      <Badge variant="outline" className="mt-1">
                        {institution.type === 'organization' ? 'Organization' : 'College'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Canteens List with Bidding */}
      {selectedInstitution && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">
                Canteens for {selectedInstitution.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                Sorted by highest bid, then priority
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setSelectedInstitution(null)}
            >
              Back to Institutions
            </Button>
          </div>

          <div className="space-y-4">
            {biddingCanteens.map((canteen, index) => {
              const isYourCanteen = canteen.id === canteenId;
              const bidAmount = bidAmounts[canteen.id] || 0;

              return (
                <Card key={canteen.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <h4 className="font-semibold text-lg">{canteen.name}</h4>
                          {isYourCanteen && (
                            <Badge variant="default">Your Canteen</Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">Current Priority</Label>
                            <div className="font-semibold">{canteen.priority ?? 0}</div>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Highest Bid</Label>
                            <div className="font-semibold flex items-center">
                              <IndianRupee className="w-4 h-4" />
                              {((canteen.currentBid || 0) / 100).toFixed(2)}
                            </div>
                          </div>
                          {canteen.yourBid !== undefined && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Your Bid</Label>
                              <div className="font-semibold flex items-center text-green-600">
                                <IndianRupee className="w-4 h-4" />
                                {(canteen.yourBid / 100).toFixed(2)}
                              </div>
                            </div>
                          )}
                          <div>
                            <Label className="text-xs text-muted-foreground">Status</Label>
                            <div>
                              {canteen.paymentStatus === 'completed' ? (
                                <Badge variant="default" className="bg-green-500">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Paid
                                </Badge>
                              ) : canteen.bidStatus === 'closed' ? (
                                <Badge variant="default" className="bg-yellow-500">
                                  Payment Due
                                </Badge>
                              ) : (
                                <Badge variant="outline">Active</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {isBiddingOpen && (
                        <div className="ml-4 flex items-end space-x-2">
                          <div>
                            <Label htmlFor={`bid-${canteen.id}`} className="text-xs">
                              Bid Amount (₹)
                            </Label>
                            <Input
                              id={`bid-${canteen.id}`}
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={bidAmount ? (bidAmount / 100).toFixed(2) : ''}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                setBidAmounts(prev => ({
                                  ...prev,
                                  [canteen.id]: Math.round(value * 100), // Convert to paise
                                }));
                              }}
                              className="w-32"
                            />
                          </div>
                          <Button
                            onClick={() => handleBid(canteen.id)}
                            disabled={createBidMutation.isPending || !bidAmount || bidAmount <= 0}
                          >
                            <Gavel className="w-4 h-4 mr-2" />
                            Place Bid
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

