-- Verify wallet tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('wallets', 'wallet_transactions')
ORDER BY table_name;
