#!/bin/bash

echo "🚀 Setting up SilloBite Connection Code System..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL environment variable is not set"
  echo "Please set it in your .env file or export it"
  exit 1
fi

echo "📊 Running database migration..."

# Run migration using Node.js (works without psql)
node run-migration.js

if [ $? -eq 0 ]; then
  echo "✅ Database migration completed successfully"
else
  echo "❌ Database migration failed"
  exit 1
fi

echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Restart the server if it's running"
echo "2. Navigate to Profile page in the app"
echo "3. Look for 'Connect to CareBite' section"
echo "4. Generate a connection code"
echo ""
echo "📖 For API documentation, see CONNECTION_CODE_README.md"
