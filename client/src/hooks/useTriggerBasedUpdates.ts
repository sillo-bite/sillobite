import { useQueryClient } from '@tanstack/react-query';

/**
 * Trigger-based update system - no polling, no loops
 * Only makes API calls when explicitly triggered
 */
export function useTriggerBasedUpdates() {
  const queryClient = useQueryClient();

  /**
   * Trigger banner refresh manually
   * Call this when you know banners have been updated
   */
  const triggerBannerRefresh = () => {
    console.log('🔄 Triggering banner refresh...');
    queryClient.invalidateQueries({ queryKey: ['/api/media-banners'] });
  };

  /**
   * Trigger menu refresh manually
   * Call this when you know menu has been updated
   */
  const triggerMenuRefresh = (canteenId?: string) => {
    console.log('🔄 Triggering menu refresh...', canteenId ? `for canteen ${canteenId}` : '');
    queryClient.invalidateQueries({ queryKey: ['/api/menu'] });
    if (canteenId) {
      queryClient.invalidateQueries({ queryKey: ['/api/menu', canteenId] });
    }
  };

  /**
   * Trigger order refresh manually
   * Call this when you know orders have been updated
   */
  const triggerOrderRefresh = (canteenId?: string) => {
    console.log('🔄 Triggering order refresh...', canteenId ? `for canteen ${canteenId}` : '');
    queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    queryClient.invalidateQueries({ queryKey: ['/api/orders/paginated'] });
    queryClient.invalidateQueries({ queryKey: ['/api/orders/active/paginated'] });
    if (canteenId) {
      queryClient.invalidateQueries({ queryKey: ['/api/orders', canteenId] });
    }
  };

  /**
   * Trigger canteen refresh manually
   * Call this when you know canteen data has been updated
   */
  const triggerCanteenRefresh = () => {
    console.log('🔄 Triggering canteen refresh...');
    queryClient.invalidateQueries({ queryKey: ['/api/system-settings/canteens'] });
    queryClient.invalidateQueries({ queryKey: ['/api/system-settings/canteens/by-college'] });
  };

  /**
   * Trigger all data refresh manually
   * Use sparingly - only when you know multiple things have changed
   */
  const triggerFullRefresh = () => {
    console.log('🔄 Triggering full data refresh...');
    queryClient.invalidateQueries();
  };

  return {
    triggerBannerRefresh,
    triggerMenuRefresh,
    triggerOrderRefresh,
    triggerCanteenRefresh,
    triggerFullRefresh
  };
}
