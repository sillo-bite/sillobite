import { Router, Request, Response } from 'express';
import { PositionBid } from '../models/mongodb-models';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

const router = Router();

/**
 * Create or update a bid for position
 */
router.post('/bid', async (req: Request, res: Response) => {
  try {
    const { canteenId, organizationId, collegeId, targetDate, bidAmount } = req.body;

    if (!canteenId || !targetDate || !bidAmount) {
      return res.status(400).json({ error: 'canteenId, targetDate, and bidAmount are required' });
    }

    if (!organizationId && !collegeId) {
      return res.status(400).json({ error: 'Either organizationId or collegeId is required' });
    }

    // Check if bidding is still open (closes at 1 PM day before)
    const target = new Date(targetDate);
    const biddingCloseTime = new Date(target);
    biddingCloseTime.setDate(biddingCloseTime.getDate() - 1);
    biddingCloseTime.setHours(13, 0, 0, 0);

    if (new Date() >= biddingCloseTime) {
      return res.status(400).json({ error: 'Bidding has closed for this date' });
    }

    // Check if bid already exists
    const existingBid = await PositionBid.findOne({
      canteenId,
      organizationId: organizationId || null,
      collegeId: collegeId || null,
      targetDate: target,
      status: { $in: ['pending', 'closed'] },
    });

    if (existingBid) {
      // Update existing bid
      existingBid.bidAmount = bidAmount;
      existingBid.status = 'pending';
      existingBid.paymentStatus = 'pending';
      existingBid.updatedAt = new Date();
      await existingBid.save();

      return res.json({
        success: true,
        bid: existingBid,
        message: 'Bid updated successfully',
      });
    } else {
      // Create new bid
      const bidId = `bid-${uuidv4()}`;
      const paymentDueTime = new Date(target);
      paymentDueTime.setDate(paymentDueTime.getDate() - 1);
      paymentDueTime.setHours(15, 0, 0, 0);

      const newBid = new PositionBid({
        bidId,
        canteenId,
        organizationId: organizationId || undefined,
        collegeId: collegeId || undefined,
        targetDate: target,
        bidAmount,
        status: 'pending',
        paymentStatus: 'pending',
        biddingClosedAt: biddingCloseTime,
        paymentDueAt: paymentDueTime,
      });

      await newBid.save();

      return res.json({
        success: true,
        bid: newBid,
        message: 'Bid created successfully',
      });
    }
  } catch (error) {
    console.error('Error creating/updating bid:', error);
    res.status(500).json({ error: 'Failed to create/update bid' });
  }
});

/**
 * Get bid for a specific canteen and institution
 */
router.get('/bid', async (req: Request, res: Response) => {
  try {
    const { canteenId, institutionId, institutionType, targetDate } = req.query;

    if (!canteenId || !institutionId || !institutionType || !targetDate) {
      return res.status(400).json({ error: 'canteenId, institutionId, institutionType, and targetDate are required' });
    }

    const target = new Date(targetDate as string);
    const query: any = {
      canteenId,
      targetDate: target,
    };

    if (institutionType === 'organization') {
      query.organizationId = institutionId;
    } else if (institutionType === 'college') {
      query.collegeId = institutionId;
    } else {
      return res.status(400).json({ error: 'Invalid institutionType' });
    }

    const bid = await PositionBid.findOne(query);

    return res.json({ bid });
  } catch (error) {
    console.error('Error fetching bid:', error);
    res.status(500).json({ error: 'Failed to fetch bid' });
  }
});

/**
 * Get all bids for an institution and target date (sorted by bid amount)
 */
router.get('/bids', async (req: Request, res: Response) => {
  try {
    const { institutionId, institutionType, targetDate } = req.query;

    if (!institutionId || !institutionType || !targetDate) {
      return res.status(400).json({ error: 'institutionId, institutionType, and targetDate are required' });
    }

    const target = new Date(targetDate as string);
    const query: any = {
      targetDate: target,
    };

    if (institutionType === 'organization') {
      query.organizationId = institutionId;
    } else if (institutionType === 'college') {
      query.collegeId = institutionId;
    } else {
      return res.status(400).json({ error: 'Invalid institutionType' });
    }

    const bids = await PositionBid.find(query)
      .sort({ bidAmount: -1, createdAt: 1 }) // Sort by highest bid, then by creation time
      .exec();

    return res.json({ bids });
  } catch (error) {
    console.error('Error fetching bids:', error);
    res.status(500).json({ error: 'Failed to fetch bids' });
  }
});

/**
 * Process payment for a bid
 */
router.post('/bid/:bidId/pay', async (req: Request, res: Response) => {
  try {
    const { bidId } = req.params;
    const { paymentTransactionId } = req.body;

    const bid = await PositionBid.findOne({ bidId });

    if (!bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    // Check if payment window is still open
    if (new Date() > bid.paymentDueAt!) {
      return res.status(400).json({ error: 'Payment window has closed' });
    }

    // Update bid with payment information
    bid.paymentStatus = 'completed';
    bid.paymentTransactionId = paymentTransactionId;
    bid.paidAt = new Date();
    bid.status = 'paid';
    await bid.save();

    return res.json({
      success: true,
      bid,
      message: 'Payment processed successfully',
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

export default router;

