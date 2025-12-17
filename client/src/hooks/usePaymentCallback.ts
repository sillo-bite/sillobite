/**
 * Custom hook for payment callback logic
 * Industry Standard: Separation of concerns - business logic extracted from UI
 */
import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { useCart } from '@/contexts/CartContext';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { PAYMENT_CONFIG, PAYMENT_STATUS, type PaymentStatus } from '@/constants/payment';
import type { PaymentData, PaymentStatusResponse, RazorpayCallbackParams, UsePaymentCallbackReturn } from '@/types/payment';
import { PaymentVerificationError, PaymentStatusCheckError, PaymentCallbackError } from '@/lib/errors/paymentErrors';
import { logger } from '@/lib/logger';
import { trackPaymentEvent } from '@/utils/analytics';
import { isPWAInstalled } from '@/utils/pwaAuth';

export function usePaymentCallback(): UsePaymentCallbackReturn {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<PaymentStatus>(PAYMENT_STATUS.CHECKING);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [orderId, setOrderId] = useState<string>('');
  const { clearCart } = useCart();
  const queryClient = useQueryClient();

  // Industry Standard: Use refs instead of global state
  const isProcessingRef = useRef(false);
  const isSuccessRef = useRef(false);
  const retryCountRef = useRef(0);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Prevent multiple simultaneous checks
    if (isProcessingRef.current || isSuccessRef.current) {
      return;
    }

    isProcessingRef.current = true;

    const checkPaymentStatus = async () => {
      const startTime = Date.now();
      let merchantTransactionId: string | null = null;

      try {
        // Extract payment info from URL or localStorage
        const urlParams = new URLSearchParams(window.location.search);
        const razorpayPaymentId = urlParams.get('razorpay_payment_id');
        const razorpayOrderId = urlParams.get('razorpay_order_id');
        const razorpaySignature = urlParams.get('razorpay_signature');

        merchantTransactionId = localStorage.getItem(PAYMENT_CONFIG.STORAGE_KEYS.TRANSACTION_ID);
        const storedOrderId = localStorage.getItem(PAYMENT_CONFIG.STORAGE_KEYS.ORDER_ID);

        // Industry Standard: Track analytics
        trackPaymentEvent('callback.started', { transactionId: merchantTransactionId || undefined });

        // If Razorpay callback parameters exist, verify and use them
        if (razorpayPaymentId && razorpayOrderId && razorpaySignature) {
          try {
            const verifyResponse = await apiRequest<PaymentStatusResponse>('/api/payments/verify-razorpay', {
              method: 'POST',
              body: JSON.stringify({
                razorpay_payment_id: razorpayPaymentId,
                razorpay_order_id: razorpayOrderId,
                razorpay_signature: razorpaySignature,
              } as RazorpayCallbackParams),
            });

            if (verifyResponse.success && verifyResponse.data?.merchantTransactionId) {
              merchantTransactionId = verifyResponse.data.merchantTransactionId as string;
              localStorage.setItem(PAYMENT_CONFIG.STORAGE_KEYS.TRANSACTION_ID, merchantTransactionId);
            }
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error('payment.verification.failed', { transactionId: merchantTransactionId }, err);
            trackPaymentEvent('verification.failed', {
              transactionId: merchantTransactionId || undefined,
              error: err.message,
            });
            throw new PaymentVerificationError(
              'Failed to verify Razorpay payment',
              merchantTransactionId || 'unknown',
              'VERIFICATION_FAILED'
            );
          }
        }

        if (!merchantTransactionId) {
          throw new PaymentCallbackError(
            'Transaction ID not found',
            'MISSING_TRANSACTION_ID'
          );
        }

        setOrderId(storedOrderId || '');

        // Check payment status with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), PAYMENT_CONFIG.TIMEOUT.STATUS_CHECK_MS);

        try {
          const statusResponse = await apiRequest<PaymentStatusResponse>(
            `/api/payments/status/${merchantTransactionId}`,
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);

          const responseTime = Date.now() - startTime;
          logger.info('payment.status.check', {
            transactionId: merchantTransactionId,
            duration: responseTime,
            status: statusResponse.status,
          });
          trackPaymentEvent('status.check', {
            transactionId: merchantTransactionId,
            duration: responseTime,
          });

          if (statusResponse.success) {
            const paymentStatus = statusResponse.status;

            if (paymentStatus === 'success') {
              // Prevent multiple success handlers from running
              if (isSuccessRef.current) {
                return;
              }

              isSuccessRef.current = true;
              isProcessingRef.current = false;

              // Clear any pending retries
              if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
              }

              // Extract order number FIRST - check multiple possible locations
              const orderNumber = statusResponse.data?.orderNumber || 
                                 (statusResponse.data as any)?.order?.orderNumber ||
                                 (statusResponse.data as any)?.orderNumber;
              
              setStatus(PAYMENT_STATUS.SUCCESS);
              // Include orderNumber in paymentData for UI display
              const paymentDataWithOrder = {
                ...(statusResponse.data || {}),
                orderNumber,
              };
              setPaymentData(paymentDataWithOrder as PaymentData);

              // Update checkout session status to completed
              const checkoutSessionId = localStorage.getItem(PAYMENT_CONFIG.STORAGE_KEYS.CHECKOUT_SESSION);
              if (checkoutSessionId) {
                try {
                  await apiRequest(`/api/checkout-sessions/${checkoutSessionId}/update-status`, {
                    method: 'POST',
                    body: JSON.stringify({ status: 'completed' }),
                  });
                  localStorage.removeItem(PAYMENT_CONFIG.STORAGE_KEYS.CHECKOUT_SESSION);
                } catch (error) {
                  const err = error instanceof Error ? error : new Error(String(error));
                  logger.error('checkout.session.update.failed', { checkoutSessionId }, err);
                }
              }

              // Clear cart immediately on successful payment
              // Get canteen ID from payment data or localStorage to ensure proper cart clearing
              try {
                const canteenId = (statusResponse.data as any)?.canteenId || 
                                 (statusResponse.data as any)?.order?.canteenId ||
                                 (() => {
                                   // Try to get from pending order data
                                   const pendingOrderData = localStorage.getItem(PAYMENT_CONFIG.STORAGE_KEYS.PENDING_ORDER);
                                   if (pendingOrderData) {
                                     try {
                                       const parsed = JSON.parse(pendingOrderData);
                                       return parsed.canteenId;
                                     } catch {
                                       return null;
                                     }
                                   }
                                   return null;
                                 })() ||
                                 localStorage.getItem('selectedCanteenId');
                
                // Clear cart using context method
                clearCart();
                
                // Also directly clear localStorage to ensure it's cleared even if context state is stale
                if (canteenId) {
                  const CART_STORAGE_PREFIX = 'digital-canteen-cart-';
                  const canteenCartKey = `${CART_STORAGE_PREFIX}${canteenId}`;
                  localStorage.removeItem(canteenCartKey);
                  logger.info('payment.cart.cleared.direct', { transactionId: merchantTransactionId, canteenId, orderNumber });
                }
                
                // Clear legacy cart key as well
                localStorage.removeItem('digital-canteen-cart');
                
                logger.info('payment.cart.cleared', { transactionId: merchantTransactionId, orderNumber, canteenId });
              } catch (cartError) {
                const err = cartError instanceof Error ? cartError : new Error(String(cartError));
                logger.error('payment.cart.clear.failed', { transactionId: merchantTransactionId }, err);
                
                // Fallback: Try to clear all cart-related keys from localStorage
                try {
                  const keys = Object.keys(localStorage);
                  keys.forEach(key => {
                    if (key.startsWith('digital-canteen-cart')) {
                      localStorage.removeItem(key);
                    }
                  });
                  logger.info('payment.cart.cleared.fallback', { transactionId: merchantTransactionId });
                } catch (fallbackError) {
                  logger.error('payment.cart.clear.fallback.failed', { transactionId: merchantTransactionId }, fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)));
                }
              }

              // Invalidate orders queries
              queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
              queryClient.invalidateQueries({ queryKey: ['/api/orders/active/paginated'] });

              // Clear stored transaction data
              localStorage.removeItem(PAYMENT_CONFIG.STORAGE_KEYS.TRANSACTION_ID);
              localStorage.removeItem(PAYMENT_CONFIG.STORAGE_KEYS.PENDING_ORDER);

              const totalDuration = Date.now() - startTime;
              logger.info('payment.success', {
                transactionId: merchantTransactionId,
                orderNumber,
                duration: totalDuration,
              });
              trackPaymentEvent('callback.success', {
                transactionId: merchantTransactionId,
                orderNumber,
                duration: totalDuration,
              });

              // SIMPLE REDIRECT: After payment success, redirect to order status page
              // Add small delay to ensure localStorage updates are persisted before redirect
              if (orderNumber) {
                const redirectUrl = `/order-status/${orderNumber}?from=payment`;
                logger.info('payment.redirect', { orderNumber, redirectUrl });
                // Small delay to ensure cart clearing is persisted to localStorage
                setTimeout(() => {
                  window.location.href = redirectUrl;
                }, 100); // 100ms delay to ensure localStorage is updated
                return; // Exit early to prevent any further processing
              } else {
                // No order number - try to get it from stored order ID
                logger.warn('payment.redirect.no.order.number', {
                  transactionId: merchantTransactionId,
                  responseData: statusResponse.data,
                });
                
                // Try to get order number from stored order ID
                const storedOrderId = localStorage.getItem(PAYMENT_CONFIG.STORAGE_KEYS.ORDER_ID);
                if (storedOrderId) {
                  try {
                    const orderResponse = await apiRequest<{ orderNumber?: string }>(
                      `/api/orders/${storedOrderId}`
                    );
                    const fetchedOrderNumber = orderResponse?.orderNumber;
                    
                    if (fetchedOrderNumber) {
                      logger.info('payment.redirect.fetched.order.number', { fetchedOrderNumber });
                      const redirectUrl = `/order-status/${fetchedOrderNumber}?from=payment`;
                      // Simple, direct redirect
                      window.location.href = redirectUrl;
                      return;
                    }
                  } catch (error) {
                    logger.error('payment.redirect.fetch.order.failed', { storedOrderId }, error instanceof Error ? error : new Error(String(error)));
                  }
                }
                
                // Fallback to orders page if no order number available
                logger.info('payment.redirect.fallback.to.orders');
                window.location.href = '/app';
              }
            } else if (paymentStatus === 'failed') {
              // Don't set failed if already successful
              if (isSuccessRef.current) {
                logger.warn('payment.status.overwrite.prevented', {
                  transactionId: merchantTransactionId,
                  attemptedStatus: 'failed',
                });
                return;
              }

              isProcessingRef.current = false;

              // Clear any pending retries
              if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
              }

              setStatus(PAYMENT_STATUS.FAILED);
              setPaymentData(statusResponse.data || null);

              // Update checkout session status to payment_failed (restores stock)
              const checkoutSessionId = localStorage.getItem(PAYMENT_CONFIG.STORAGE_KEYS.CHECKOUT_SESSION);
              if (checkoutSessionId) {
                try {
                  await apiRequest(`/api/checkout-sessions/${checkoutSessionId}/update-status`, {
                    method: 'POST',
                    body: JSON.stringify({ status: 'payment_failed' }),
                  });
                  localStorage.removeItem(PAYMENT_CONFIG.STORAGE_KEYS.CHECKOUT_SESSION);
                  logger.info('checkout.session.updated.payment_failed', { checkoutSessionId });
                } catch (error) {
                  const err = error instanceof Error ? error : new Error(String(error));
                  logger.error('checkout.session.update.failed', { checkoutSessionId }, err);
                }
              }

              // Create order for failed payment if needed
              if (!statusResponse.data?.orderNumber && statusResponse.data?.merchantTransactionId) {
                try {
                  const createOrderResponse = await apiRequest<{ success: boolean; order?: { orderNumber: string } }>(
                    `/api/payments/${statusResponse.data.merchantTransactionId}/create-failed-order`,
                    { method: 'POST' }
                  );
                  if (createOrderResponse.success && createOrderResponse.order) {
                    logger.info('order.created.for.failed.payment', {
                      orderNumber: createOrderResponse.order.orderNumber,
                      transactionId: merchantTransactionId,
                    });
                  }
                } catch (error) {
                  const err = error instanceof Error ? error : new Error(String(error));
                  logger.error('order.creation.failed', { transactionId: merchantTransactionId }, err);
                }
              }

              queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
              queryClient.invalidateQueries({ queryKey: ['/api/orders/active/paginated'] });

              localStorage.removeItem(PAYMENT_CONFIG.STORAGE_KEYS.TRANSACTION_ID);

              trackPaymentEvent('callback.failed', {
                transactionId: merchantTransactionId,
              });
            } else if (paymentStatus === 'pending') {
              // Don't retry if already successful
              if (isSuccessRef.current) {
                logger.warn('payment.status.overwrite.prevented', {
                  transactionId: merchantTransactionId,
                  attemptedStatus: 'pending',
                });
                return;
              }

              setStatus(PAYMENT_STATUS.PENDING);
              setPaymentData(statusResponse.data || null);

              // Retry logic with max attempts
              if (retryCountRef.current < PAYMENT_CONFIG.RETRY.MAX_ATTEMPTS) {
                retryCountRef.current += 1;

                // Clear any existing retry timeout before setting new one
                if (retryTimeoutRef.current) {
                  clearTimeout(retryTimeoutRef.current);
                }

                retryTimeoutRef.current = setTimeout(() => {
                  // Check again if still not successful before retrying
                  if (!isSuccessRef.current && !isProcessingRef.current) {
                    isProcessingRef.current = true;
                    checkPaymentStatus();
                  }
                }, PAYMENT_CONFIG.RETRY.INTERVAL_MS);

                trackPaymentEvent('callback.pending', {
                  transactionId: merchantTransactionId,
                  retryCount: retryCountRef.current,
                });
              } else {
                // After max retries, keep in pending state
                isProcessingRef.current = false;
                setStatus(PAYMENT_STATUS.PENDING);
                logger.warn('payment.retry.max.reached', {
                  transactionId: merchantTransactionId,
                  retryCount: retryCountRef.current,
                });
              }
            }
          } else {
            // Response not successful
            if (!isSuccessRef.current) {
              isProcessingRef.current = false;
              setStatus(PAYMENT_STATUS.FAILED);
              throw new PaymentStatusCheckError(
                'Payment status check returned unsuccessful response',
                merchantTransactionId,
                'INVALID_RESPONSE'
              );
            }
          }
        } catch (timeoutError) {
          clearTimeout(timeoutId);
          const err = timeoutError instanceof Error ? timeoutError : new Error(String(timeoutError));
          
          // Check if it's an abort error (timeout)
          const isAbortError = err.name === 'AbortError' || err.message.includes('aborted');
          
          logger.error('payment.status.check.timeout', { 
            transactionId: merchantTransactionId,
            isAbortError,
            errorName: err.name,
            errorMessage: err.message,
          });

          if (!isSuccessRef.current) {
            // FIX: Don't immediately fail on timeout - retry instead
            // The server might be slow but still processing
            logger.info('payment.status.check.timeout.retrying', {
              transactionId: merchantTransactionId,
              retryCount: retryCountRef.current,
              maxAttempts: PAYMENT_CONFIG.RETRY.MAX_ATTEMPTS,
            });
            
            // Set status to pending instead of failed to allow retry
            setStatus(PAYMENT_STATUS.PENDING);
            setPaymentData({ 
              merchantTransactionId,
              message: 'Payment verification is taking longer than expected. Please wait...',
              isTimeout: true,
            } as any);
            
            // Retry with exponential backoff
            if (retryCountRef.current < PAYMENT_CONFIG.RETRY.MAX_ATTEMPTS) {
              retryCountRef.current += 1;
              const retryDelay = Math.min(
                PAYMENT_CONFIG.RETRY.INTERVAL_MS * Math.pow(2, retryCountRef.current - 1),
                10000 // Max 10 seconds between retries
              );
              
              if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
              }
              
              // Don't set isProcessingRef to false - keep it true so retry can proceed
              // It will be set to true again at the start of checkPaymentStatus
              
              retryTimeoutRef.current = setTimeout(() => {
                logger.info('payment.status.check.retry.after.timeout', {
                  transactionId: merchantTransactionId,
                  retryCount: retryCountRef.current,
                });
                // Reset processing flag to allow retry
                isProcessingRef.current = false;
                checkPaymentStatus();
              }, retryDelay);
            } else {
              // Max retries reached - show failed state
              isProcessingRef.current = false;
              setStatus(PAYMENT_STATUS.FAILED);
              setPaymentData({ 
                merchantTransactionId,
                message: 'Payment verification timed out. Please check your orders or try again.',
                isTimeout: true,
              } as any);
              
              trackPaymentEvent('callback.timeout', {
                transactionId: merchantTransactionId || undefined,
              });
            }
          }
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('payment.callback.error', { transactionId: merchantTransactionId }, err);

        // Don't set failed if already successful
        if (!isSuccessRef.current) {
          isProcessingRef.current = false;
          setStatus(PAYMENT_STATUS.FAILED);

          trackPaymentEvent('callback.failed', {
            transactionId: merchantTransactionId || undefined,
            error: err.message,
          });
        }
      }
    };

    checkPaymentStatus();

    // Cleanup function to clear timeouts
    return () => {
      // Clear retry timeout on cleanup
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      // Clear redirect timeout if component unmounts (redirect should have already happened)
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
      isProcessingRef.current = false;
    };
  }, [setLocation, clearCart, queryClient]);

  const handleRetry = () => {
    // Clear payment transaction data but keep pending order data
    localStorage.removeItem(PAYMENT_CONFIG.STORAGE_KEYS.TRANSACTION_ID);

    // Check if we have pending order data to retry
    const pendingOrderData = localStorage.getItem(PAYMENT_CONFIG.STORAGE_KEYS.PENDING_ORDER);
    if (pendingOrderData) {
      setLocation('/checkout');
    } else {
      window.dispatchEvent(new CustomEvent('appNavigateToCart', {}));
      setLocation('/app');
    }
  };

  const handleGoToOrders = () => {
    window.dispatchEvent(new CustomEvent('appNavigateToOrders', {}));
    setLocation('/app');
  };

  return {
    status,
    paymentData,
    orderId,
    handleRetry,
    handleGoToOrders,
  };
}

